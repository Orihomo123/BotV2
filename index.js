const { 
    Client, 
    GatewayIntentBits, 
    SlashCommandBuilder, 
    EmbedBuilder, 
    REST, 
    Routes 
} = require('discord.js');
const noblox = require('noblox.js');
const express = require('express'); // Added for Render uptime

// ==================== CONFIGURATION ====================
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || "PASTE_YOUR_DISCORD_BOT_TOKEN_HERE";
const ROBLOX_COOKIE = process.env.ROBLOX_COOKIE || "PASTE_YOUR_ROBLOX_COOKIE_HERE";

const PREFIX = ".rank";
const GROUP_ID = 243948679;
const REQUIRED_ROLE_ID = '1482918985052717247'; 
const LOG_CHANNEL_ID = '1519338982553686277'; 
// =======================================================

// --- KEEP-ALIVE WEB SERVER FOR RENDER ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot is running safely online!');
});

app.listen(PORT, () => {
    console.log(`🌐 Web server is listening on port ${PORT} to maintain Render uptime.`);
});
// ----------------------------------------

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ] 
});

const RANKS = {
    'free_access': { name: 'Dmm • Associate - (fr33)', id: 2 },
    'free access': { name: 'Dmm • Associate - (fr33)', id: 2 },
    'free': { name: 'Dmm • Associate - (fr33)', id: 2 },
    'soldato': { name: 'Dmm • Soldato Access', id: 3 },
    'capo': { name: 'Dmm • Capo Access', id: 4 },
    'underboss': { name: 'Dmm • Underboss Access', id: 5 },
    'consigliere': { name: 'Dmm • Consigliere Access', id: 6 }
};

const PAYMENTS = ['cash app', 'cashapp', 'venmo', 'robux', 'paypal', 'free access', 'free', 'apple pay', 'applepay'];

let robloxAuthenticated = false;

client.once('ready', async () => {
    console.log(`✅ Connected to Discord as ${client.user.tag}!`);
    
    try {
        await noblox.setCookie(ROBLOX_COOKIE);
        const currentUser = await noblox.getAuthenticatedUser();
        console.log(`✅ Logged into Roblox as ${currentUser.UserName}`);
        robloxAuthenticated = true;
    } catch (error) {
        console.error('❌ Roblox Authentication Failed:', error.message);
        robloxAuthenticated = false;
    }

    // Register Slash Command
    const commands = [
        new SlashCommandBuilder()
            .setName('setrank')
            .setDescription('Change a user\'s rank in the Roblox group.')
            .addStringOption(option => option.setName('roblox_username').setDescription('The exact Roblox username').setRequired(true))
            .addUserOption(option => option.setName('discord_user').setDescription('The Discord user being ranked').setRequired(true))
            .addStringOption(option => option.setName('rank').setDescription('The target rank').setRequired(true).addChoices(
                { name: 'free access', value: 'free_access' },
                { name: 'Dmm • Soldato Access', value: 'soldato' },
                { name: 'Dmm • Capo Access', value: 'capo' },
                { name: 'Dmm • Underboss Access', value: 'underboss' },
                { name: 'Dmm • Consigliere Access', value: 'consigliere' }
            ))
            .addUserOption(option => option.setName('ranked_by').setDescription('The staff member who completed the ranking session').setRequired(true))
            .addStringOption(option => option.setName('payment_method').setDescription('Select the payment method used').setRequired(true).addChoices(
                { name: 'cash app', value: 'Cash App' },
                { name: 'venmo', value: 'Venmo' },
                { name: 'robux', value: 'Robux' },
                { name: 'paypal', value: 'PayPal' },
                { name: 'free access', value: 'Free Access' },
                { name: 'apple pay', value: 'Apple Pay' }
            ))
            .addStringOption(option => option.setName('proof').setDescription('Paste an image link/URL for proof').setRequired(true))
    ];

    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    try {
        console.log('🔄 Syncing slash (/) commands with Discord...');
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ Global slash commands successfully reloaded!');
    } catch (error) {
        console.error('❌ Failed to register slash commands:', error);
    }
});

// ==================== HANDLER 1: SLASH COMMANDS (/setrank) ====================
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'setrank') {
        await interaction.deferReply(); 

        const member = interaction.member;
        const requiredRole = interaction.guild.roles.cache.get(REQUIRED_ROLE_ID);
        if (!requiredRole || !member.roles.cache.some(role => role.position >= requiredRole.position)) {
            return interaction.editReply({ content: '❌ You do not have permission or required role to use this command.' });
        }

        if (!robloxAuthenticated) {
            return interaction.editReply({ content: '❌ Error: The bot is currently not authenticated with Roblox. Fix cookie setup.' });
        }

        const robloxUsername = interaction.options.getString('roblox_username');
        const discordUser = interaction.options.getUser('discord_user');
        const rankKey = interaction.options.getString('rank');
        const rankedBy = interaction.options.getUser('ranked_by');
        const paymentMethod = interaction.options.getString('payment_method');
        const proofUrl = interaction.options.getString('proof');
        
        const targetRank = RANKS[rankKey];

        try {
            const robloxId = await noblox.getIdFromUsername(robloxUsername).catch(() => null);
            if (!robloxId) return interaction.editReply({ content: `❌ Could not find a Roblox user named \`${robloxUsername}\`.` });

            const currentRankNumber = await noblox.getRankInGroup(GROUP_ID, robloxId);
            if (currentRankNumber === 0) {
                const notInGroupEmbed = new EmbedBuilder().setTitle('❌ Error').setColor(0xFF0000).setDescription(`User is not found, make sure user in group.`);
                return interaction.editReply({ embeds: [notInGroupEmbed] });
            }

            await noblox.setRank(GROUP_ID, robloxId, targetRank.id);

            const embed = new EmbedBuilder()
                .setTitle('🔰 Group Rank Updated')
                .setColor(0x00FF00)
                .setDescription(`Successfully ranked the user in the Roblox group!`)
                .addFields(
                    { name: 'Roblox Username', value: `[${robloxUsername}](https://www.roblox.com/users/${robloxId}/profile)`, inline: true },
                    { name: 'Discord User', value: `${discordUser}`, inline: true },
                    { name: 'New Rank', value: `${targetRank.name}`, inline: false },
                    { name: 'Payment Method', value: `${paymentMethod}`, inline: true },
                    { name: 'Ranked By', value: `${rankedBy}`, inline: true }
                ).setTimestamp();

            if (proofUrl.startsWith('http://') || proofUrl.startsWith('https://')) embed.setImage(proofUrl);
            else embed.addFields({ name: 'Proof provided (Text)', value: proofUrl });

            await interaction.editReply({ embeds: [embed] });

            const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel) await logChannel.send({ embeds: [embed] });

        } catch (error) {
            return interaction.editReply({ content: `❌ Failed to change rank: \`${error.message}\`` });
        }
    }
});

// ==================== HANDLER 2: CHAT COMMANDS (.rank) ====================
client.on('messageCreate', async message => {
    if (message.content.toLowerCase() === '.ping') return message.reply('🏓 Pong!');
    if (message.author.bot || !message.content.toLowerCase().startsWith(PREFIX)) return;

    const member = message.member;
    const requiredRole = message.guild.roles.cache.get(REQUIRED_ROLE_ID);
    if (!requiredRole || !member.roles.cache.some(role => role.position >= requiredRole.position)) {
        return message.reply('❌ You do not have permission to use this command.');
    }

    if (!robloxAuthenticated) return message.reply('❌ Error: Bot is not logged into Roblox.');

    const fullText = message.content.slice(PREFIX.length).trim();
    const args = fullText.split(/ +/);
    if (args.length < 6) return message.reply(`❌ **Invalid Format!** Use:\n\`.rank [Roblox_Username] [@Discord_User] [Rank] [@Ranked_By] [Payment_Method] [Proof_Link]\``);

    const robloxUsername = args[0];
    const mentionsArray = [...message.mentions.users.values()];
    const discordUser = mentionsArray[0];
    const rankedBy = mentionsArray[1];

    if (!discordUser || !rankedBy) return message.reply('❌ Error: You must tag both the target user **AND** the staff member.');

    const lowerText = fullText.toLowerCase();
    let targetRankKey = Object.keys(RANKS).find(rank => lowerText.includes(rank));
    let targetPayment = PAYMENTS.find(pay => lowerText.includes(pay));
    const proofUrl = args[args.length - 1];

    if (!targetRankKey) return message.reply('❌ Invalid rank choice.');
    if (!targetPayment) return message.reply('❌ Invalid payment method.');

    try {
        const robloxId = await noblox.getIdFromUsername(robloxUsername).catch(() => null);
        if (!robloxId) return message.reply(`❌ Could not find Roblox user \`${robloxUsername}\`.`);

        const currentRankNumber = await noblox.getRankInGroup(GROUP_ID, robloxId);
        if (currentRankNumber === 0) {
            const notInGroupEmbed = new EmbedBuilder().setTitle('❌ Error').setColor(0xFF0000).setDescription(`User is not found, make sure user in group.`);
            return message.reply({ embeds: [notInGroupEmbed] });
        }

        await noblox.setRank(GROUP_ID, robloxId, RANKS[targetRankKey].id);

        const embed = new EmbedBuilder()
            .setTitle('🔰 Group Rank Updated')
            .setColor(0x00FF00)
            .setDescription(`Successfully ranked the user in the Roblox group!`)
            .addFields(
                { name: 'Roblox Username', value: `[${robloxUsername}](https://www.roblox.com/users/${robloxId}/profile)`, inline: true },
                { name: 'Discord User', value: `${discordUser}`, inline: true },
                { name: 'New Rank', value: `${RANKS[targetRankKey].name}`, inline: false },
                { name: 'Payment Method', value: `${targetPayment.toUpperCase()}`, inline: true },
                { name: 'Ranked By', value: `${rankedBy}`, inline: true }
            ).setTimestamp();

        if (proofUrl.startsWith('http://') || proofUrl.startsWith('https://')) embed.setImage(proofUrl);
        else embed.addFields({ name: 'Proof provided (Text)', value: proofUrl });

        await message.channel.send({ embeds: [embed] });

        const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) await logChannel.send({ embeds: [embed] });

    } catch (error) {
        return message.reply(`❌ Failed to change rank: \`${error.message}\``);
    }
});

client.login(DISCORD_TOKEN);
