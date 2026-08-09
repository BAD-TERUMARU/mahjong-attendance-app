const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
} = require("discord.js");
const { getConfig } = require("./config");
const { readCsv } = require("./lib/csv");
const { loadStore, saveStore } = require("./lib/storage");

const STATUS = {
  available: { mark: "〇", label: "参加", button: ButtonStyle.Success },
  tentative: { mark: "△", label: "未定", button: ButtonStyle.Secondary },
  unavailable: { mark: "×", label: "不参加", button: ButtonStyle.Danger },
};

const config = getConfig();

function normalizeMatch(row) {
  return {
    matchId: row.match_id,
    date: row.date,
    weekday: row.weekday,
    startTime: row.start_time,
    opponentTeam: row.opponent_team,
    currentPoints: row.current_points,
    requiredPlayers: Number(row.required_players || 0),
    note: row.note || "",
  };
}

function normalizeMember(row) {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    discordUserId: row.discord_user_id,
    role: row.role,
    note: row.note || "",
  };
}

async function loadData() {
  if (!config.matchDaysCsv) throw new Error("開催日CSVが見つかりません。data/match-days.csv を作成してください。");
  if (!config.membersCsv) throw new Error("メンバーCSVが見つかりません。data/members.csv を作成してください。");

  const matches = (await readCsv(config.matchDaysCsv)).map(normalizeMatch).filter((row) => row.matchId);
  const members = (await readCsv(config.membersCsv)).map(normalizeMember).filter((row) => row.discordUserId);
  return { matches, members };
}

function responseKey(matchId, discordUserId) {
  return `${matchId}:${discordUserId}`;
}

function getMemberName(members, discordUserId, fallbackName) {
  return members.find((member) => member.discordUserId === discordUserId)?.displayName || fallbackName || `<@${discordUserId}>`;
}

function getCounts(match, members, store) {
  const buckets = {
    available: [],
    tentative: [],
    unavailable: [],
    unanswered: [],
  };

  for (const member of members) {
    const response = store.responses[responseKey(match.matchId, member.discordUserId)];
    if (response?.status && buckets[response.status]) {
      buckets[response.status].push(member.displayName);
    } else {
      buckets.unanswered.push(member.displayName);
    }
  }

  return {
    ...buckets,
    shortage: Math.max(0, match.requiredPlayers - buckets.available.length),
  };
}

function formatNames(names) {
  if (names.length === 0) return "-";
  return names.join(", ");
}

function buildEmbed(match, members, store) {
  const counts = getCounts(match, members, store);
  const title = `${match.date} ${match.weekday} ${match.startTime} vs ${match.opponentTeam}`;
  const description = [
    `相手ポイント: ${match.currentPoints || "-"}`,
    `必要人数: ${match.requiredPlayers || "-"}`,
    match.note ? `メモ: ${match.note}` : null,
  ].filter(Boolean).join("\n");

  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(counts.shortage > 0 ? 0xd97706 : 0x15803d)
    .addFields(
      { name: `〇 参加 ${counts.available.length}人`, value: formatNames(counts.available), inline: false },
      { name: `△ 未定 ${counts.tentative.length}人`, value: formatNames(counts.tentative), inline: false },
      { name: `× 不参加 ${counts.unavailable.length}人`, value: formatNames(counts.unavailable), inline: false },
      { name: `未回答 ${counts.unanswered.length}人`, value: formatNames(counts.unanswered), inline: false },
      { name: "不足", value: `${counts.shortage}人`, inline: true },
      { name: "match_id", value: match.matchId, inline: true },
    )
    .setFooter({ text: "ボタンから出欠を更新できます" })
    .setTimestamp(new Date());
}

function buildButtons(matchId) {
  return new ActionRowBuilder().addComponents(
    Object.entries(STATUS).map(([status, info]) =>
      new ButtonBuilder()
        .setCustomId(`attendance:respond:${matchId}:${status}`)
        .setLabel(`${info.mark} ${info.label}`)
        .setStyle(info.button),
    ),
  );
}

async function upsertMatchMessage(channel, match, members, store) {
  const stored = store.matches[match.matchId] || {};
  const payload = {
    embeds: [buildEmbed(match, members, store)],
    components: [buildButtons(match.matchId)],
  };

  if (stored.channelId && stored.messageId) {
    try {
      const existingChannel = await channel.client.channels.fetch(stored.channelId);
      const message = await existingChannel.messages.fetch(stored.messageId);
      await message.edit(payload);
      return message;
    } catch (error) {
      console.warn(`Could not edit existing message for ${match.matchId}. Creating a new one.`, error.message);
    }
  }

  const message = await channel.send(payload);
  store.matches[match.matchId] = {
    channelId: message.channelId,
    messageId: message.id,
  };
  return message;
}

async function refreshMatchMessage(client, match, members, store) {
  const stored = store.matches[match.matchId];
  if (!stored?.channelId || !stored?.messageId) return;

  const channel = await client.channels.fetch(stored.channelId);
  const message = await channel.messages.fetch(stored.messageId);
  await message.edit({
    embeds: [buildEmbed(match, members, store)],
    components: [buildButtons(match.matchId)],
  });
}

function buildSummaryText(matches, members, store, matchId) {
  const selected = matchId ? matches.filter((match) => match.matchId === matchId) : matches;
  if (selected.length === 0) return `対象の開催日が見つかりません: ${matchId}`;

  return selected.map((match) => {
    const counts = getCounts(match, members, store);
    return [
      `**${match.date} ${match.weekday} ${match.startTime} vs ${match.opponentTeam}**`,
      `相手ポイント: ${match.currentPoints || "-"} / 必要人数: ${match.requiredPlayers}`,
      `〇 ${counts.available.length} / △ ${counts.tentative.length} / × ${counts.unavailable.length} / 未回答 ${counts.unanswered.length} / 不足 ${counts.shortage}`,
    ].join("\n");
  }).join("\n\n");
}

async function handleAttendanceCommand(interaction, data, store) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "sync") {
    await interaction.deferReply({ ephemeral: true });
    const channel = interaction.options.getChannel("channel") || interaction.channel;

    for (const match of data.matches) {
      await upsertMatchMessage(channel, match, data.members, store);
    }
    await saveStore(config.storePath, store);
    await interaction.editReply(`募集メッセージを ${data.matches.length} 件作成・更新しました。`);
    return;
  }

  if (subcommand === "summary") {
    const matchId = interaction.options.getString("match_id");
    await interaction.reply({
      content: buildSummaryText(data.matches, data.members, store, matchId),
      ephemeral: true,
    });
    return;
  }

  if (subcommand === "remind") {
    const matchId = interaction.options.getString("match_id", true);
    const match = data.matches.find((item) => item.matchId === matchId);
    if (!match) {
      await interaction.reply({ content: `対象の開催日が見つかりません: ${matchId}`, ephemeral: true });
      return;
    }

    const counts = getCounts(match, data.members, store);
    const mentions = data.members
      .filter((member) => counts.unanswered.includes(member.displayName))
      .map((member) => `<@${member.discordUserId}>`);
    await interaction.reply({
      content: mentions.length > 0 ? `未回答者: ${mentions.join(" ")}` : "未回答者はいません。",
      ephemeral: true,
      allowedMentions: { users: [] },
    });
  }
}

async function handleButton(interaction, data, store) {
  const [, action, matchId, status] = interaction.customId.split(":");
  if (action !== "respond" || !STATUS[status]) return;

  const match = data.matches.find((item) => item.matchId === matchId);
  if (!match) {
    await interaction.reply({ content: `対象の開催日が見つかりません: ${matchId}`, ephemeral: true });
    return;
  }

  store.responses[responseKey(matchId, interaction.user.id)] = {
    matchId,
    discordUserId: interaction.user.id,
    displayName: getMemberName(data.members, interaction.user.id, interaction.member?.displayName),
    status,
    updatedAt: new Date().toISOString(),
  };
  await saveStore(config.storePath, store);
  await refreshMatchMessage(interaction.client, match, data.members, store);

  await interaction.reply({
    content: `${match.date} vs ${match.opponentTeam} を「${STATUS[status].mark} ${STATUS[status].label}」で登録しました。`,
    ephemeral: true,
  });
}

async function main() {
  if (!config.token) throw new Error("DISCORD_TOKEN を .env に設定してください。");

  const data = await loadData();
  const store = await loadStore(config.storePath);
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once(Events.ClientReady, (readyClient) => {
    console.log(`Logged in as ${readyClient.user.tag}`);
    console.log(`Loaded ${data.matches.length} matches and ${data.members.length} members.`);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isChatInputCommand() && interaction.commandName === "attendance") {
        await handleAttendanceCommand(interaction, data, store);
      }

      if (interaction.isButton() && interaction.customId.startsWith("attendance:")) {
        await handleButton(interaction, data, store);
      }
    } catch (error) {
      console.error(error);
      const message = "処理中にエラーが発生しました。Botのログを確認してください。";
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: message, ephemeral: true });
      } else {
        await interaction.reply({ content: message, ephemeral: true });
      }
    }
  });

  await client.login(config.token);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

