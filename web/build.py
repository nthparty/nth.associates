import sys
import os
import os.path
import shutil
import json
import subprocess

def src():
    """
    Return concatenation of all the application JavaScript
    source modules.
    """
    # Gather paths of all source files.
    file_paths = [
        os.path.join("src", file_name)
        for file_name in os.listdir("src")
        if os.path.isfile(os.path.join("src", file_name))
        if file_name.endswith(".js")
    ]

    # Concatenate all source files together.
    modules = []
    for file_path in file_paths:
        with open(file_path, "r") as file:
            modules.append(file.read())

    return "\n\n".join(modules)

def copy(src_dir, dst_dir, ext):
    """
    Copy all files in a directory that fit a pattern
    to another subdirectory.
    """
    file_names = [
        file_name
        for file_name in os.listdir(src_dir)
        if os.path.isfile(os.path.join(src_dir, file_name))
        if file_name.endswith("." + ext)
    ]
    for file_name in file_names:
        shutil.copyfile(
            os.path.join(src_dir, file_name),
            os.path.join(dst_dir, file_name)
        )

def obfuscate(src_code, file_path):

    with open(file_path, "w") as src_out:
        src_out.write(src_code)

    subprocess.run(["node", "./obf/obf.js", file_path])
    with open(file_path, "r") as obf_js:
        ret = obf_js.read()
    subprocess.run(["rm", "./main.js"])
    return ret

def application(config):
    """
    Build main application HTML file.
    """
    # Load the JSON configuration file.
    with open(os.path.join("cfg", config + ".json"), "r") as config_file:
        config_dict = json.load(config_file)
        config_json = json.dumps(config_dict, indent=2)

        # Application object and global constant used to
        # reference the application object throughout
        # the HTML document.
        app_config_global_var =\
            """const app = new App(""" + config_json + """);""".strip()

        js = src() + "\n" + app_config_global_var
        if config_dict.get("obfuscate") == True:
            js = obfuscate(js, "./main.js")

        with open("html/index.html", "r") as index_template:
            index_template = index_template.read()

            if "gtagId" in config_dict:
                index_template = index_template.replace(
                    "<script async src=\"https://www.googletagmanager.com/gtag/js?id=G-61KM98K7WJ\"></script>",
                    f"<script async src=\"https://www.googletagmanager.com/gtag/js?id={config_dict['gtagId']}\"></script>"
                )
                index_template = index_template.replace(
                    "gtag('config', 'G-61KM98K7WJ');",
                    f"gtag('config', \"{config_dict['gtagId']}\");"
                )

            # Add HTML and CSS components based on configuration.
            if "tagline" in config_dict:
                index_template = index_template.replace(
                    "<!--tagline-->",
                    '<div class="tagline noselect">' + config_dict["tagline"] + '</div>'
                )

            if "offboardEmbeddedFeedbackSurvey" in config_dict and\
               config_dict["offboardEmbeddedFeedbackSurvey"]:
                with open("html/content-offboard-typeform.html", "r") as html:
                    index_template = index_template.replace(
                        "<!--content-offboard-typeform-->",
                        ("<td>" + html.read().strip() + "</td>")
                    )

            if config_dict.get("socialMediaSharing") == True:
                with open("html/social-media-sharing.css", "r") as social_css:
                    index_template = index_template.replace(
                        "<!--social-media-sharing-css-->",
                        "    <style>\n" + social_css.read().strip() + "\n    </style>\n"
                    )
                with open("html/social-media-sharing.html", "r") as social_html:
                    index_template = index_template.replace(
                        "<!--social-media-sharing-html-->",
                        social_html.read().strip()
                    )

            with open("dist/index.html", "w") as index_dist:
                index_dist.write(
                    index_template
                        .replace("const app = {initialize: () => {}};", js)
                        .strip()
                )

def dist(config):
    """
    Create a copy of the application files that are
    ready for distribution in the `dist` directory.
    """
    # Clear out old directory if it exists and make a new one.
    if os.path.exists("dist"):
        shutil.rmtree("dist")
    os.makedirs("dist")

    # Build the main application file.
    application(config)

    # Copy other necessary HTML content files.
    for file in ["legal-privacy-policy", "legal-terms-of-service"]:
        shutil.copyfile("html/" + file + ".html", "dist/" + file + ".html")

    # Copy all user interface image assets.
    copy("html", "dist", "svg")

    # Copy all bundled external libraries.
    copy("lib", "dist", "js")

    # Copy all data files.
    copy("data", "dist", "json")

    print("Ready-to-deploy application files are now found in `dist/`.")

if __name__ == "__main__":
    dist("nth.associates" if len(sys.argv) != 2 else sys.argv[1])
