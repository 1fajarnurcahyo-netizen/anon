# AnonChat - Anonymous Random Video Chat

A production-ready anonymous random chat website similar to Omegle, built with modern web technologies.

![AnonChat Preview](https://via.placeholder.com/800x400?text=AnonChat+Preview)

## 🚀 Features

### Random Matching System
- ✅ Automatic stranger pairing
- ✅ Queue-based matchmaking
- ✅ Instant reconnect when clicking "Next"
- ✅ No duplicate pairing
- ✅ Auto cleanup inactive rooms

### Chat System
- ✅ Realtime text chat via Supabase
- ✅ Typing indicator
- ✅ Emoji support with picker
- ✅ Send images (with compression)
- ✅ Send files
- ✅ Chat auto-scroll
- ✅ Message timestamps
- ✅ Auto clear chat when switching partner

### Video Call System
- ✅ WebRTC peer-to-peer video chat
- ✅ Toggle camera on/off
- ✅ Toggle microphone on/off
- ✅ Switch camera (front/back on mobile)
- ✅ Fullscreen video
- ✅ Video reconnect if connection drops
- ✅ Mobile browser support

### UI/UX
- ✅ Modern dark theme UI
- ✅ Responsive mobile design
- ✅ Smooth animations
- ✅ Clean chat layout
- ✅ Stranger video + self video (PiP) layout
- ✅ Online users counter
- ✅ Connection status indicator

### Anti-Abuse & Security
- ✅ Spam detection
- ✅ Rate limit messages (10 per 10 seconds)
- ✅ Auto disconnect inactive users (5 minutes)
- ✅ Report user button with reasons
- ✅ Temporary ban system (database)
- ✅ Basic profanity filter

### Performance & Scalability
- ✅ Optimized for 1000+ concurrent users
- ✅ Efficient matchmaking queue
- ✅ Peer-to-peer media streams (no server bandwidth)
- ✅ Lightweight frontend (no heavy frameworks)
- ✅ Lazy loading scripts

## 📋 Requirements

- Web browser with WebRTC support
- Supabase account (free tier works)
- cPanel shared hosting or any static hosting

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend/Database**: Supabase (PostgreSQL + Realtime)
- **Video/Audio**: WebRTC (Peer-to-peer)
- **Signaling**: Supabase Realtime subscriptions

## 📦 Installation

### 1. Clone or Download

```bash
git clone https://github.com/yourusername/anonchat.git
cd anonchat
```

### 2. Setup Supabase

1. Create a free account at [Supabase](https://supabase.com)
2. Create a new project
3. Go to **SQL Editor** in your Supabase dashboard
4. Copy the contents of `public_html/supabase-schema.sql` and execute it
5. Go to **Project Settings > API**
6. Copy your **Project URL** and **anon public key**

### 3. Configure the App

Edit `public_html/app.js` and update the configuration:

```javascript
const CONFIG = {
    SUPABASE_URL: 'https://your-project.supabase.co',
    SUPABASE_ANON_KEY: 'your-anon-key-here',
    // ... other settings
};
```

### 4. Deploy to cPanel

1. Upload all files from `public_html/` to your `public_html` directory on cPanel
2. Ensure the following files are present:
   - `index.html`
   - `style.css`
   - `app.js`

### 5. Enable Realtime in Supabase

1. Go to **Database > Replication** in Supabase dashboard
2. Enable replication for tables: `rooms`, `messages`, `signals`

## 📁 Project Structure

```
public_html/
├── index.html          # Main HTML file
├── style.css           # All CSS styles
├── app.js              # Main JavaScript application
└── supabase-schema.sql # Database schema for Supabase
```

## 🗄️ Database Schema

### Tables

| Table | Description |
|-------|-------------|
| `rooms` | Active chat rooms with matchmaking info |
| `messages` | Chat messages (text, images, files) |
| `signals` | WebRTC signaling data |
| `reports` | User reports for moderation |
| `banned_users` | Banned user tracking |

### Relationships

```
rooms ──< messages
rooms ──< reports
signals (standalone)
banned_users (standalone)
```

## 🔧 Configuration Options

Edit the `CONFIG` object in `app.js`:

```javascript
const CONFIG = {
    // Supabase credentials
    SUPABASE_URL: 'your-url',
    SUPABASE_ANON_KEY: 'your-key',
    
    // Timeouts (in milliseconds)
    MATCHMAKING_TIMEOUT: 30000,    // 30 seconds
    INACTIVE_TIMEOUT: 300000,      // 5 minutes
    TYPING_TIMEOUT: 3000,          // 3 seconds
    
    // Rate limiting
    MESSAGE_RATE_LIMIT: 10,        // messages per 10 seconds
    MAX_MESSAGE_LENGTH: 1000,
    MAX_FILE_SIZE: 10485760,       // 10MB
    
    // WebRTC ICE servers
    RTC_CONFIG: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            // Add TURN servers for better NAT traversal
        ]
    }
};
```

## 🎨 Customization

### Theme Colors

Edit CSS variables in `style.css`:

```css
:root {
    --bg-primary: #0f0f1a;
    --bg-secondary: #1a1a2e;
    --accent-primary: #6c5ce7;
    --accent-secondary: #a29bfe;
    --success: #00d26a;
    --danger: #ff4757;
    /* ... more variables */
}
```

### Adding TURN Servers

For better connectivity behind NAT/firewalls, add TURN servers:

```javascript
RTC_CONFIG: {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        {
            urls: 'turn:your-turn-server.com:3478',
            username: 'username',
            credential: 'password'
        }
    ]
}
```

## 🔒 Security Considerations

1. **Anonymous Access**: The app uses permissive RLS policies for anonymous users
2. **Rate Limiting**: Messages are rate-limited to prevent spam
3. **Profanity Filter**: Basic profanity filtering is implemented
4. **Report System**: Users can report abusive behavior
5. **Ban System**: Database supports temporary/permanent bans

### For Production

- Implement proper authentication (Supabase Auth)
- Add content moderation (AI or manual review)
- Use TURN servers with authentication
- Enable Supabase Row Level Security with proper policies
- Add SSL/HTTPS (required for WebRTC)

## 📱 Mobile Support

The app is fully responsive and supports:
- iOS Safari
- Android Chrome
- Mobile camera switching
- Touch-friendly controls

## 🐛 Troubleshooting

### Camera/Microphone Not Working
- Ensure HTTPS is enabled (required for WebRTC)
- Check browser permissions
- Try a different browser

### No Matches Found
- Check Supabase connection
- Verify Realtime is enabled
- Check browser console for errors

### Video Not Connecting
- Check ICE candidates in console
- Add TURN servers for better NAT traversal
- Verify firewall settings

## 📄 License

MIT License - feel free to use for personal or commercial projects.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For issues or questions:
- Open a GitHub issue
- Check the troubleshooting section above

---

Built with ❤️ using modern web technologies