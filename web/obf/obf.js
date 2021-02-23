let fs = require("fs")
let JavaScriptObfuscator = require("javascript-obfuscator")
let filePath = (process.argv[2] != null) ? process.argv[2] : './main.js'

fs.readFile(filePath, "UTF-8", function(err, data) {
    if (err) {
        throw err;
    }

    var obfResult = JavaScriptObfuscator.obfuscate(data,
        {
            optionsPreset: 'high-obfuscation',
            renameGlobals: false,
        });

    fs.writeFile("./main.js", obfResult.getObfuscatedCode(), function(err) {
        if (err) {
            return console.log(err);
        }

        console.log("Saved file")
    });
});


