"""
run.py

This file combines all necessary steps in order
to start the Python server with its associated
TypeScript static file.
"""
# We use os in oder to perform console commands
import os
import shutil

# Transpile the TypeScript file to JavaScript

with open("static/script.ts", "r", encoding="utf-8") as f:
    tstext = f.read()
tstext = tstext.replace(
    "socket.io-client", "../static/node_modules/socket.io-client/dist/socket.io.js"
)
with open("static/script_TEMP.ts", "w", encoding="utf-8") as f:
    f.writelines(tstext)
os.system("tsc ./static/script_TEMP.ts --target es2022")
os.remove("static/script_TEMP.ts")
shutil.move("static/script_TEMP.js", "static/script.js")

with open("static/script.js", "r", encoding="utf-8") as f:
    jslines = f.readlines()
jslines = [x for x in jslines if not x.startswith("import ")]
with open("static/script.js", "w", encoding="utf-8") as f:
    f.writelines(jslines)

# Now, with the corrected JavaScript file,
# start the server.
os.system("python ./server.py")
