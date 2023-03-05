"""
run.py

This file combines all necessary steps in order
to start the Python server with its associated
TypeScript static file.
"""
# We use os in oder to perform console commands
import os

# Transpile the TypeScript file to JavaScript
os.system("tsc ./static/script.ts --target es2022")

with open("static/script.js", "r", encoding="utf-8") as f:
    jslines = f.readlines()
jslines = [x for x in jslines if not x.startswith("import ")]
with open("static/script.js", "w", encoding="utf-8") as f:
    f.writelines(jslines)

# Now, with the corrected JavaScript file,
# start the server.
os.system("python ./server.py")
