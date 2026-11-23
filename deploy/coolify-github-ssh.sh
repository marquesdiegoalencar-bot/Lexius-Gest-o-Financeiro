#!/bin/sh
# Rode no VPS (Coolify) se aparecer "Host key verification failed" ao clonar repo.
set -e
mkdir -p /root/.ssh
chmod 700 /root/.ssh
ssh-keyscan -t ed25519,rsa github.com >> /root/.ssh/known_hosts 2>/dev/null
chmod 600 /root/.ssh/known_hosts
echo "github.com em known_hosts. Teste:"
GIT_SSH_COMMAND='ssh -o BatchMode=yes' git ls-remote git@github.com:marquesdiegoalencar-bot/Lexius-Gest-o-Financeiro.git HEAD | head -1