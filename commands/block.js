const {
  SlashCommandBuilder,
  PermissionsBitField,
  ChannelType,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("block")
    .setDescription(
      "Bloqueia TODOS os canais de voz do servidor, permitindo acesso apenas a administradores."
    )
    // Garante que apenas membros com permissão de "Gerenciar Canais" possam usar o comando.
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels),

  async execute(interaction) {
    // 1. Busca todos os canais de voz do servidor
    const voiceChannels = interaction.guild.channels.cache.filter(
      (channel) => channel.type === ChannelType.GuildVoice
    );

    // 2. Verifica se existem canais de voz no servidor
    if (voiceChannels.size === 0) {
      return interaction.reply({
        content: "Este servidor não possui nenhum canal de voz!",
        ephemeral: true,
      });
    }

    // 3. Verifica as permissões do bot
    const botMember = interaction.guild.members.me;
    const channelsWithoutPermission = [];

    // Verifica quais canais o bot não pode gerenciar
    voiceChannels.forEach((channel) => {
      if (
        !channel
          .permissionsFor(botMember)
          .has([
            PermissionsBitField.Flags.ManageChannels,
            PermissionsBitField.Flags.ManageRoles,
          ])
      ) {
        channelsWithoutPermission.push(channel.name);
      }
    });

    if (channelsWithoutPermission.length > 0) {
      return interaction.reply({
        content: `Eu não tenho permissões para gerenciar os seguintes canais de voz: **${channelsWithoutPermission.join(", ")}**\n\nVerifique se eu tenho as permissões 'Gerenciar Canais' e 'Gerenciar Cargos' e se meu cargo está acima dos outros na hierarquia.`,
        ephemeral: true,
      });
    }

    // 4. Resposta inicial para o usuário (o processo pode demorar um pouco)
    await interaction.reply(
      "🔄 Bloqueando todos os canais de voz do servidor..."
    );

    const everyoneRole = interaction.guild.roles.everyone;
    const successfulBlocks = [];
    const failedBlocks = [];

    try {
      // 5. Busca cargo de administrador para dar permissões especiais
      const adminRole = interaction.guild.roles.cache.find((role) =>
        role.permissions.has(PermissionsBitField.Flags.Administrator)
      );

      const owner = await interaction.guild.fetchOwner();

      // 6. Processa cada canal de voz
      for (const [channelId, channel] of voiceChannels) {
        try {
          // Bloqueia o canal para @everyone
          await channel.permissionOverwrites.edit(everyoneRole, {
            Connect: false,
            ViewChannel: false,
          });

          // Garante que administradores possam acessar
          if (adminRole) {
            await channel.permissionOverwrites.edit(adminRole, {
              Connect: true,
              ViewChannel: true,
            });
          }

          // Garante que o dono do servidor possa acessar
          await channel.permissionOverwrites.edit(owner, {
            Connect: true,
            ViewChannel: true,
          });

          successfulBlocks.push(channel.name);

          // Pequena pausa para evitar rate limits
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (channelError) {
          console.error(
            `Erro ao bloquear canal ${channel.name}:`,
            channelError
          );
          failedBlocks.push(channel.name);
        }
      }

      // 7. Monta a mensagem de resultado
      let resultMessage = "";

      if (successfulBlocks.length > 0) {
        resultMessage += `🔒 **Canais bloqueados com sucesso (${successfulBlocks.length}):**\n`;
        // Limita a lista para não fazer a mensagem muito longa
        const displayChannels = successfulBlocks.slice(0, 10);
        resultMessage += displayChannels.map((name) => `• ${name}`).join("\n");

        if (successfulBlocks.length > 10) {
          resultMessage += `\n• ... e mais ${successfulBlocks.length - 10} canais`;
        }
        resultMessage +=
          "\n\n✅ Apenas administradores podem acessar estes canais agora!";
      }

      if (failedBlocks.length > 0) {
        if (resultMessage) resultMessage += "\n\n";
        resultMessage += `❌ **Falha ao bloquear (${failedBlocks.length}):**\n`;
        resultMessage += failedBlocks.map((name) => `• ${name}`).join("\n");
      }

      // 8. Atualiza a mensagem com o resultado final
      await interaction.editReply(resultMessage);
    } catch (error) {
      console.error("Erro geral ao tentar bloquear canais:", error);

      await interaction.editReply({
        content:
          "❌ Ocorreu um erro inesperado ao tentar bloquear os canais de voz. Verifique as permissões do bot e tente novamente.",
      });
    }
  },
};
