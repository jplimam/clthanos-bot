// deploy-commands.js

require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");

const commands = [];

// Carrega comandos diretamente da pasta commands (sem subpastas)
const commandsPath = path.join(__dirname, "commands");

// Verifica se a pasta commands existe
if (!fs.existsSync(commandsPath)) {
  console.log("Pasta 'commands' não encontrada!");
  process.exit(1);
}

const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

console.log(`Encontrados ${commandFiles.length} arquivos de comando:`);

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  console.log(`Carregando: ${file}`);

  try {
    const command = require(filePath);

    if ("data" in command && "execute" in command) {
      commands.push(command.data.toJSON());
      console.log(`✅ Comando '${command.data.name}' carregado com sucesso!`);
    } else {
      console.log(
        `[WARNING] O comando em ${filePath} não possui a propriedade "data" ou "execute".`
      );
    }
  } catch (error) {
    console.error(`Erro ao carregar o comando ${file}:`, error);
  }
}

// Verifica se as variáveis de ambiente estão definidas
if (!process.env.DISCORD_TOKEN) {
  console.error("DISCORD_TOKEN não encontrado no arquivo .env!");
  process.exit(1);
}

if (!process.env.CLIENT_ID) {
  console.error("CLIENT_ID não encontrado no arquivo .env!");
  process.exit(1);
}

if (!process.env.GUILD_ID) {
  console.error("GUILD_ID não encontrado no arquivo .env!");
  process.exit(1);
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

// Deploy commands
(async () => {
  try {
    console.log(
      `Started refreshing ${commands.length} application (/) commands.`
    );

    // The put method is used to fully refresh all commands in the guild with the current set
    const data = await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );

    console.log(
      `Successfully reloaded ${data.length} application (/) commands.`
    );
  } catch (error) {
    // And of course, make sure you catch and log any errors!
    console.error("Erro ao fazer deploy dos comandos:", error);

    if (error.code === 50001) {
      console.error("Bot não tem acesso ao servidor especificado!");
    } else if (error.code === 50013) {
      console.error("Bot não tem permissões suficientes!");
    } else if (error.code === 10004) {
      console.error("GUILD_ID inválido!");
    }
  }
})();
