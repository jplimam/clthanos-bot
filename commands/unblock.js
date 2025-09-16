const {
  SlashCommandBuilder,
  PermissionsBitField,
  ChannelType,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("unblock")
    .setDescription(
      "Desbloqueia TODOS os canais de voz do servidor, permitindo acesso a todos os usuários."
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
        content: `Eu não tenho permissões para gerenciar os seguintes canais de voz: **${channelsWithoutPermission.join(", ")}**\n\nVerifique se eu tenho as permissões necessárias.`,
        ephemeral: true,
      });
    }

    // 4. Resposta inicial
    await interaction.reply(
      "🔄 Desbloqueando todos os canais de voz do servidor..."
    );

    const everyoneRole = interaction.guild.roles.everyone;
    const successfulUnblocks = [];
    const alreadyUnblocked = [];
    const failedUnblocks = [];

    try {
      // 5. Processa cada canal de voz
      for (const [channelId, channel] of voiceChannels) {
        try {
          // Verifica se o canal está bloqueado
          const everyoneOverride = channel.permissionOverwrites.cache.get(
            everyoneRole.id
          );

          if (
            !everyoneOverride ||
            everyoneOverride.allow.has(PermissionsBitField.Flags.Connect)
          ) {
            alreadyUnblocked.push(channel.name);
            continue;
          }

          // Remove as restrições de permissão do canal
          await channel.permissionOverwrites.edit(everyoneRole, {
            Connect: null, // null remove a override, voltando à permissão padrão
            ViewChannel: null,
          });

          // Remove overrides específicas de administradores se existirem
          const adminRole = interaction.guild.roles.cache.find((role) =>
            role.permissions.has(PermissionsBitField.Flags.Administrator)
          );

          if (adminRole) {
            const adminOverride = channel.permissionOverwrites.cache.get(
              adminRole.id
            );
            if (adminOverride) {
              await adminOverride.delete();
            }
          }

          // Remove override do dono do servidor se existir
          const owner = await interaction.guild.fetchOwner();
          const ownerOverride = channel.permissionOverwrites.cache.get(
            owner.id
          );
          if (ownerOverride) {
            await ownerOverride.delete();
          }

          successfulUnblocks.push(channel.name);

          // Pequena pausa para evitar rate limits
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (channelError) {
          console.error(
            `Erro ao desbloquear canal ${channel.name}:`,
            channelError
          );
          failedUnblocks.push(channel.name);
        }
      }

      // 6. Monta a mensagem de resultado
      let resultMessage = "";

      if (successfulUnblocks.length > 0) {
        resultMessage += `🔓 **Canais desbloqueados com sucesso (${successfulUnblocks.length}):**\n`;
        const displayChannels = successfulUnblocks.slice(0, 10);
        resultMessage += displayChannels.map((name) => `• ${name}`).join("\n");

        if (successfulUnblocks.length > 10) {
          resultMessage += `\n• ... e mais ${successfulUnblocks.length - 10} canais`;
        }
        resultMessage +=
          "\n\n✅ Todos os usuários podem acessar estes canais novamente!";
      }

      if (alreadyUnblocked.length > 0) {
        if (resultMessage) resultMessage += "\n\n";
        resultMessage += `✅ **Canais que já estavam desbloqueados (${alreadyUnblocked.length}):**\n`;
        const displayChannels = alreadyUnblocked.slice(0, 5);
        resultMessage += displayChannels.map((name) => `• ${name}`).join("\n");

        if (alreadyUnblocked.length > 5) {
          resultMessage += `\n• ... e mais ${alreadyUnblocked.length - 5} canais`;
        }
      }

      if (failedUnblocks.length > 0) {
        if (resultMessage) resultMessage += "\n\n";
        resultMessage += `❌ **Falha ao desbloquear (${failedUnblocks.length}):**\n`;
        resultMessage += failedUnblocks.map((name) => `• ${name}`).join("\n");
      }

      if (!resultMessage) {
        resultMessage = "✅ Processo concluído!";
      }

      // 7. Atualiza a mensagem com o resultado final
      await interaction.editReply(resultMessage);
    } catch (error) {
      console.error("Erro geral ao tentar desbloquear canais:", error);

      await interaction.editReply({
        content:
          "❌ Ocorreu um erro inesperado ao tentar desbloquear os canais de voz. Verifique as permissões do bot e tente novamente.",
      });
    }
  },
};
