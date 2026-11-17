#!/usr/bin/env bash
# Construit l'APK sans Gradle, avec le SDK d'Android Studio, puis l'installe si un téléphone est branché.
# Usage (Git Bash) : bash build.sh
set -euo pipefail
cd "$(dirname "$0")"
SDK="$LOCALAPPDATA/Android/Sdk"
BT="$SDK/build-tools/36.0.0"
JAR="$SDK/platforms/android-35/android.jar"
JBIN="/c/Program Files/Android/Android Studio/jbr/bin"
export JAVA_HOME="$(cygpath -w "/c/Program Files/Android/Android Studio/jbr")"
export PATH="$JBIN:$PATH"

rm -rf build && mkdir -p build/res build/classes build/dex build/assets/www
cp ../index.html ../app.js ../data.js ../recettes.js ../journal.js ../cuisine.js ../placard.js ../planner.js ../tickets.js ../cloud.js ../zxing.min.js ../icon.svg build/assets/www/

"$BT/aapt2" compile --dir res -o build/res/res.zip
"$BT/aapt2" link -I "$JAR" --manifest AndroidManifest.xml -A build/assets \
  -o build/unsigned.apk --java build/gen build/res/res.zip
javac -source 11 -target 11 -nowarn -cp "$JAR" -d build/classes \
  $(find src build/gen -name '*.java') 2>&1 | grep -v "bootstrap classpath" || true
"$BT/d8.bat" --lib "$JAR" --min-api 26 --output build/dex $(find build/classes -name '*.class')
python -I -c "import zipfile,sys;zipfile.ZipFile(sys.argv[1],'a',zipfile.ZIP_DEFLATED).write(sys.argv[2],'classes.dex')" build/unsigned.apk build/dex/classes.dex
"$BT/zipalign" -f 4 build/unsigned.apk build/aligned.apk

# Clé de signature locale (créée une seule fois ; à garder pour pouvoir mettre l'appli à jour)
[ -f courses.keystore ] || keytool -genkeypair -keystore courses.keystore -alias courses \
  -keyalg RSA -keysize 2048 -validity 10000 -storepass courses -keypass courses -dname "CN=Courses"
"$BT/apksigner.bat" sign --ks courses.keystore --ks-pass pass:courses --out Courses.apk build/aligned.apk
echo "APK prêt : $(pwd)/Courses.apk"

# N'installe que sur le Pixel (le Quest 3 est souvent branché aussi : ne jamais installer dessus)
PHONE=$(adb devices -l | grep -w device | grep "model:Pixel" | awk '{print $1}' | head -1)
if [ -n "$PHONE" ]; then
  adb -s "$PHONE" install -r Courses.apk && adb -s "$PHONE" shell monkey -p fr.huggo.courses -c android.intent.category.LAUNCHER 1 >/dev/null
  echo "Installé et lancé sur le téléphone ($PHONE)."
else
  echo "Pixel non détecté par adb (rien installé). Branche-le avec le débogage USB puis relance."
fi
