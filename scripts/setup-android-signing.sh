#!/bin/sh
# One-time setup: create a permanent signing key for the Android app and store it
# as GitHub repo secrets, so every new APK installs over the old one (keeping data).
# A backup of the key and its password stays in ~/.shortlist-android (never in the repo).
set -e
D="$HOME/.shortlist-android"
mkdir -p "$D" && chmod 700 "$D" && cd "$D"

if [ -f shortlist-release.p12 ]; then
  echo "Key already exists in $D, reusing it."
else
  openssl rand -hex 24 | tr -d '\n' > keystore-password.txt
  PW=$(cat keystore-password.txt)
  openssl req -x509 -newkey rsa:4096 -sha256 -days 10000 -nodes \
    -keyout key.pem -out cert.pem -subj "/CN=Shortlist/C=IN" 2>/dev/null
  openssl pkcs12 -export -inkey key.pem -in cert.pem -name shortlist \
    -out shortlist-release.p12 -passout pass:"$PW"
  rm -f key.pem
  chmod 600 ./*
  echo "Created key in $D (back this folder up somewhere safe)."
fi

REPO=aadhavanm02/shortlist
base64 -i shortlist-release.p12 | gh secret set ANDROID_KEYSTORE_B64 -R "$REPO"
gh secret set ANDROID_KEYSTORE_PASSWORD -R "$REPO" < keystore-password.txt
printf shortlist | gh secret set ANDROID_KEY_ALIAS -R "$REPO"
gh workflow run android.yml -R "$REPO"
echo "Done. Secrets saved and a new signed APK build has started."
