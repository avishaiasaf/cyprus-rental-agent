# Cyprus Rental Agent — Server Installation Guide

## Server Requirements

- **OS**: Ubuntu 22.04+ (or Debian 12+)
- **RAM**: 4 GB minimum (Playwright browser needs ~1.5 GB)
- **CPU**: 2 vCPU
- **Disk**: 40 GB SSD
- **Domain**: A record pointing to the server IP

Recommended: Hetzner CX22 (~5 EUR/mo) or DigitalOcean 4GB Droplet.

---

## 1. Server Setup

SSH in as root and run:

```bash
# Create deploy user
adduser deploy
usermod -aG sudo deploy

# Set up SSH key auth for deploy user
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys

# Disable root login and password auth
sed -i 's/^PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd

# Firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# Install Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy

# Install Caddy
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy

# Enable unattended security updates
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
```

Log out and SSH back in as `deploy`.

---

## 2. Deploy the Application

```bash
# Clone the repo
cd /opt
sudo mkdir cyprus-rental && sudo chown deploy:deploy cyprus-rental
git clone https://github.com/avishaiasaf/cyprus-rental-agent.git cyprus-rental
cd cyprus-rental

# Create directories
mkdir -p data/images backups
```

### Create `.env`

```bash
cat > .env << 'EOF'
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id
POSTGRES_PASSWORD=CHANGE_ME_TO_A_STRONG_PASSWORD
DATABASE_URL=postgresql://agent:CHANGE_ME_TO_A_STRONG_PASSWORD@postgres:5432/cyprus_rental
APIFY_API_TOKEN=your-apify-token
TELEGRAM_API_ID=your-api-id
TELEGRAM_API_HASH=your-api-hash
EOF
chmod 600 .env
```

> **Important**: Use the same password in both `POSTGRES_PASSWORD` and `DATABASE_URL`.

### Create `config.yaml`

Copy `config.example.yaml` and edit to your needs:

```bash
cp config.example.yaml config.yaml
nano config.yaml
```

Update the Telegram bot token/channel, enable/disable sources, etc.

---

## 3. Configure Caddy (HTTPS)

```bash
sudo cp Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

The `Caddyfile` is already configured for `cy.re.solutionlabtech.com`. Edit it if your domain is different:

```bash
sudo nano /etc/caddy/Caddyfile
```

Caddy will automatically get a Let's Encrypt HTTPS certificate once DNS propagates.

---

## 4. Start Everything

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

First build takes 5-10 minutes (Playwright image is large). Subsequent builds are cached.

### Verify it's running:

```bash
# Check containers
docker compose -f docker-compose.prod.yml ps

# Check health
curl http://localhost:3000/health

# Check logs
docker compose -f docker-compose.prod.yml logs -f agent --tail 50
```

Visit `https://your-domain.com` — you should see the search page.

---

## 5. Set Up Backups

```bash
chmod +x scripts/backup-db.sh scripts/restore-db.sh scripts/check-health.sh

# Add to crontab
crontab -e
```

Add these lines:

```
# Daily database backup at 3 AM
0 3 * * * /opt/cyprus-rental/scripts/backup-db.sh >> /var/log/cyprus-rental-backup.log 2>&1

# Health check every 5 minutes
*/5 * * * * /opt/cyprus-rental/scripts/check-health.sh
```

---

## Updating

To deploy a new version:

```bash
cd /opt/cyprus-rental
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Useful Commands

```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f agent
docker compose -f docker-compose.prod.yml logs -f web
docker compose -f docker-compose.prod.yml logs -f postgres

# Restart a service
docker compose -f docker-compose.prod.yml restart agent

# Stop everything
docker compose -f docker-compose.prod.yml down

# Restore database from backup
./scripts/restore-db.sh backups/cyprus_rental_20260315_030000.sql.gz

# Check disk usage
docker system df
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `502 Bad Gateway` | Containers still starting. Wait 30s, check `docker ps` |
| `HTTPS not working` | Verify DNS A record points to server IP. Check `sudo systemctl status caddy` |
| `Database connection refused` | Postgres might still be starting. Check `docker logs cyprus-rental-postgres` |
| `Out of memory` | Agent uses ~1.5 GB for Playwright. Ensure 4 GB RAM or add swap: `sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile` |
