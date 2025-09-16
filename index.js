// Importa os módulos necessários
require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const cron = require("node-cron");
const {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  ChannelType,
  PermissionsBitField,
} = require("discord.js");

// Pega o token do arquivo .env
const token = process.env.DISCORD_TOKEN;

// -----------------------------------------------------------------------------------
// 🔥 PONTO CRÍTICO: A inicialização do Cliente com as Intents corretas.
// Adicionamos 'GatewayIntentBits.GuildVoiceStates' para que o bot possa
// "ver" quem está nos canais de voz. Sem isso, comandos como /block não funcionam.
// -----------------------------------------------------------------------------------
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

// Cria uma coleção para armazenar os comandos
client.commands = new Collection();

// Variável para controlar se o agendamento automático está ativo
let autoScheduleEnabled = false;
let targetGuildId = null; // ID do servidor onde o agendamento será executado

// Carregamento dinâmico dos arquivos de comando
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);

  // Verifica se o comando tem as propriedades 'data' e 'execute'
  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.log(
      `[AVISO] O comando em ${filePath} não possui a propriedade "data" ou "execute".`
    );
  }
}

// Função para bloquear todos os canais de voz de um servidor
async function blockAllVoiceChannels(guildId) {
  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      console.log(`[AGENDAMENTO] Servidor ${guildId} não encontrado.`);
      return;
    }

    const voiceChannels = guild.channels.cache.filter(
      (channel) => channel.type === ChannelType.GuildVoice
    );

    if (voiceChannels.size === 0) {
      console.log(
        `[AGENDAMENTO] Servidor ${guild.name} não possui canais de voz.`
      );
      return;
    }

    const everyoneRole = guild.roles.everyone;
    const adminRole = guild.roles.cache.find((role) =>
      role.permissions.has(PermissionsBitField.Flags.Administrator)
    );
    const owner = await guild.fetchOwner();

    let blockedCount = 0;
    let failedCount = 0;

    for (const [channelId, channel] of voiceChannels) {
      try {
        await channel.permissionOverwrites.edit(everyoneRole, {
          Connect: false,
          ViewChannel: false,
        });

        if (adminRole) {
          await channel.permissionOverwrites.edit(adminRole, {
            Connect: true,
            ViewChannel: true,
          });
        }

        await channel.permissionOverwrites.edit(owner, {
          Connect: true,
          ViewChannel: true,
        });

        blockedCount++;
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(
          `[AGENDAMENTO] Erro ao bloquear canal ${channel.name}:`,
          error
        );
        failedCount++;
      }
    }

    console.log(
      `[AGENDAMENTO] 🔒 Bloqueados ${blockedCount} canais de voz no servidor ${guild.name}. Falhas: ${failedCount}`
    );
  } catch (error) {
    console.error(`[AGENDAMENTO] Erro geral ao bloquear canais:`, error);
  }
}

// Função para desbloquear todos os canais de voz de um servidor
async function unblockAllVoiceChannels(guildId) {
  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      console.log(`[AGENDAMENTO] Servidor ${guildId} não encontrado.`);
      return;
    }

    const voiceChannels = guild.channels.cache.filter(
      (channel) => channel.type === ChannelType.GuildVoice
    );

    if (voiceChannels.size === 0) {
      console.log(
        `[AGENDAMENTO] Servidor ${guild.name} não possui canais de voz.`
      );
      return;
    }

    const everyoneRole = guild.roles.everyone;
    const adminRole = guild.roles.cache.find((role) =>
      role.permissions.has(PermissionsBitField.Flags.Administrator)
    );

    let unblockedCount = 0;
    let failedCount = 0;

    for (const [channelId, channel] of voiceChannels) {
      try {
        // Remove restrições do @everyone
        await channel.permissionOverwrites.edit(everyoneRole, {
          Connect: null,
          ViewChannel: null,
        });

        // Remove overrides de admin se existirem
        if (adminRole) {
          const adminOverride = channel.permissionOverwrites.cache.get(
            adminRole.id
          );
          if (adminOverride) {
            await adminOverride.delete();
          }
        }

        // Remove override do dono se existir
        const owner = await guild.fetchOwner();
        const ownerOverride = channel.permissionOverwrites.cache.get(owner.id);
        if (ownerOverride) {
          await ownerOverride.delete();
        }

        unblockedCount++;
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(
          `[AGENDAMENTO] Erro ao desbloquear canal ${channel.name}:`,
          error
        );
        failedCount++;
      }
    }

    console.log(
      `[AGENDAMENTO] 🔓 Desbloqueados ${unblockedCount} canais de voz no servidor ${guild.name}. Falhas: ${failedCount}`
    );
  } catch (error) {
    console.error(`[AGENDAMENTO] Erro geral ao desbloquear canais:`, error);
  }
}

// Evento que roda uma única vez quando o bot está pronto
client.once(Events.ClientReady, (readyClient) => {
  console.log(`✅ Pronto! Logado como ${readyClient.user.tag}`);

  // Configura os agendamentos automáticos
  setupScheduler();
});

// Função para configurar os agendamentos
function setupScheduler() {
  // Agendamento para BLOQUEAR às 7:00 AM (segunda a sexta) - Horário de Brasília
  cron.schedule(
    "0 7 * * 1-5",
    () => {
      if (autoScheduleEnabled && targetGuildId) {
        console.log(
          `[AGENDAMENTO] Executando bloqueio automático às 7:00 AM...`
        );
        blockAllVoiceChannels(targetGuildId);
      }
    },
    {
      scheduled: true,
      timezone: "America/Sao_Paulo", // Horário de Brasília
    }
  );

  // Agendamento para DESBLOQUEAR às 17:00 PM (segunda a sexta) - Horário de Brasília
  cron.schedule(
    "0 17 * * 1-5",
    () => {
      if (autoScheduleEnabled && targetGuildId) {
        console.log(
          `[AGENDAMENTO] Executando desbloqueio automático às 17:00 PM...`
        );
        unblockAllVoiceChannels(targetGuildId);
      }
    },
    {
      scheduled: true,
      timezone: "America/Sao_Paulo", // Horário de Brasília
    }
  );

  console.log("📅 Agendamentos configurados:");
  console.log("   🔒 Bloqueio: Segunda a Sexta às 07:00 (Horário de Brasília)");
  console.log(
    "   🔓 Desbloqueio: Segunda a Sexta às 17:00 (Horário de Brasília)"
  );
}

// Função para ativar o agendamento automático
function enableAutoSchedule(guildId) {
  autoScheduleEnabled = true;
  targetGuildId = guildId;
  console.log(`[AGENDAMENTO] Ativado para o servidor: ${guildId}`);
}

// Função para desativar o agendamento automático
function disableAutoSchedule() {
  autoScheduleEnabled = false;
  targetGuildId = null;
  console.log(`[AGENDAMENTO] Desativado.`);
}

// Exporta as funções para uso nos comandos
client.enableAutoSchedule = enableAutoSchedule;
client.disableAutoSchedule = disableAutoSchedule;
client.getScheduleStatus = () => ({
  enabled: autoScheduleEnabled,
  guildId: targetGuildId,
});

// Listener de interações (comandos de barra)
client.on(Events.InteractionCreate, async (interaction) => {
  // Ignora interações que não são comandos de barra
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.client.commands.get(interaction.commandName);

  // Se o comando não for encontrado, avisa no console
  if (!command) {
    console.error(
      `Nenhum comando correspondente a "${interaction.commandName}" foi encontrado.`
    );
    return;
  }

  // Tenta executar o comando
  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    // Responde ao usuário com uma mensagem de erro genérica e privada
    const errorMessage = {
      content: "Ocorreu um erro ao executar este comando!",
      ephemeral: true,
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
});

// Faz o login do bot no Discord
client.login(token);
