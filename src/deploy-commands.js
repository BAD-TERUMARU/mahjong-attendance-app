const { REST, Routes, SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require("discord.js");
const { getConfig } = require("./config");

const command = new SlashCommandBuilder()
  .setName("attendance")
  .setDescription("麻雀チームの出欠管理")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("sync")
      .setDescription("CSVの開催日リストから募集メッセージを作成・更新します")
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("募集メッセージを投稿するチャンネル")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(false),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("summary")
      .setDescription("出欠集計を表示します")
      .addStringOption((option) =>
        option.setName("match_id").setDescription("対象のmatch_id。省略時は全日程。").setRequired(false),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("remind")
      .setDescription("未回答者を確認します")
      .addStringOption((option) =>
        option.setName("match_id").setDescription("対象のmatch_id").setRequired(true),
      ),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages);

async function main() {
  const config = getConfig();
  if (!config.token || !config.clientId || !config.guildId) {
    throw new Error("DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID を .env に設定してください。");
  }

  const rest = new REST({ version: "10" }).setToken(config.token);
  await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
    body: [command.toJSON()],
  });
  console.log("Registered /attendance commands.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

