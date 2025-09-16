const { SlashCommandBuilder, PermissionsBitField } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("schedule")
    .setDescription(
      "Controla o agendamento automático de bloqueio/desbloqueio de canais de voz"
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("ativar")
        .setDescription(
          "Ativa o agendamento automático (7h bloqueia, 17h desbloqueia, seg-sex)"
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("desativar")
        .setDescription("Desativa o agendamento automático")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("status")
        .setDescription("Verifica o status atual do agendamento")
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "ativar":
        // Ativa o agendamento para este servidor
        interaction.client.enableAutoSchedule(interaction.guild.id);

        await interaction.reply({
          content:
            `✅ **Agendamento automático ATIVADO!**\n\n` +
            `📅 **Programação:**\n` +
            `🔒 **Bloqueio:** Segunda a Sexta às **07:00** (Horário de Brasília)\n` +
            `🔓 **Desbloqueio:** Segunda a Sexta às **17:00** (Horário de Brasília)\n\n` +
            `🎯 **Servidor:** ${interaction.guild.name}\n` +
            `⚠️ **Importante:** Todos os canais de voz serão bloqueados/desbloqueados automaticamente!\n\n` +
            `Use \`/schedule desativar\` para parar o agendamento.`,
          ephemeral: false,
        });
        break;

      case "desativar":
        interaction.client.disableAutoSchedule();

        await interaction.reply({
          content:
            `❌ **Agendamento automático DESATIVADO!**\n\n` +
            `Os canais não serão mais bloqueados/desbloqueados automaticamente.\n` +
            `Você ainda pode usar os comandos \`/block\` e \`/unblock\` manualmente.`,
          ephemeral: false,
        });
        break;

      case "status":
        const status = interaction.client.getScheduleStatus();

        if (status.enabled && status.guildId === interaction.guild.id) {
          // Calcula próximos agendamentos
          const now = new Date();
          const nowBrasilia = new Date(
            now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
          );

          // Próximo bloqueio (7:00 AM)
          let nextBlock = new Date(nowBrasilia);
          nextBlock.setHours(7, 0, 0, 0);

          // Se já passou das 7h hoje, vai para o próximo dia útil
          if (nowBrasilia.getHours() >= 7) {
            nextBlock.setDate(nextBlock.getDate() + 1);
          }

          // Ajusta para próximo dia útil se for fim de semana
          while (nextBlock.getDay() === 0 || nextBlock.getDay() === 6) {
            nextBlock.setDate(nextBlock.getDate() + 1);
          }

          // Próximo desbloqueio (17:00 PM)
          let nextUnblock = new Date(nowBrasilia);
          nextUnblock.setHours(17, 0, 0, 0);

          if (nowBrasilia.getHours() >= 17) {
            nextUnblock.setDate(nextUnblock.getDate() + 1);
          }

          while (nextUnblock.getDay() === 0 || nextUnblock.getDay() === 6) {
            nextUnblock.setDate(nextUnblock.getDate() + 1);
          }

          const formatDate = (date) => {
            const days = [
              "Domingo",
              "Segunda",
              "Terça",
              "Quarta",
              "Quinta",
              "Sexta",
              "Sábado",
            ];
            const dayName = days[date.getDay()];
            const dateStr = date.toLocaleDateString("pt-BR");
            const timeStr = date.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            });
            return `${dayName}, ${dateStr} às ${timeStr}`;
          };

          await interaction.reply({
            content:
              `📊 **Status do Agendamento Automático**\n\n` +
              `🟢 **Status:** ATIVO\n` +
              `🎯 **Servidor:** ${interaction.guild.name}\n` +
              `🕐 **Horário atual (Brasília):** ${nowBrasilia.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}\n\n` +
              `⏰ **Próximos agendamentos:**\n` +
              `🔒 **Próximo bloqueio:** ${formatDate(nextBlock)}\n` +
              `🔓 **Próximo desbloqueio:** ${formatDate(nextUnblock)}\n\n` +
              `📋 **Configuração:**\n` +
              `• Bloqueio: Segunda a Sexta às 07:00\n` +
              `• Desbloqueio: Segunda a Sexta às 17:00\n` +
              `• Fuso horário: Brasília (GMT-3)`,
            ephemeral: false,
          });
        } else if (status.enabled && status.guildId !== interaction.guild.id) {
          const targetGuild = interaction.client.guilds.cache.get(
            status.guildId
          );
          const guildName = targetGuild
            ? targetGuild.name
            : "Servidor desconhecido";

          await interaction.reply({
            content:
              `⚠️ **Agendamento ativo em outro servidor!**\n\n` +
              `O agendamento automático está ativo para: **${guildName}**\n\n` +
              `Para ativar neste servidor, primeiro use \`/schedule desativar\` e depois \`/schedule ativar\`.`,
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content:
              `🔴 **Agendamento automático DESATIVADO**\n\n` +
              `Use \`/schedule ativar\` para começar o agendamento automático.\n\n` +
              `📋 **Como funciona:**\n` +
              `• **07:00** - Bloqueia todos os canais de voz\n` +
              `• **17:00** - Desbloqueia todos os canais de voz\n` +
              `• **Dias:** Segunda a Sexta apenas\n` +
              `• **Fuso:** Horário de Brasília`,
            ephemeral: false,
          });
        }
        break;
    }
  },
};
