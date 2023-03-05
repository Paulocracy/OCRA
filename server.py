from flask import Flask, render_template
from flask_socketio import SocketIO, send, emit
from io import BytesIO
from ocra import OCRAProject
import base64
import os
from PIL import Image
from tkinter import messagebox, filedialog
from platform import system

from utils import standardize_file_path, standardize_folder_path

async_mode = None
app = Flask(__name__)
app.config["SECRET_KEY"] = "secret!"
socketio = SocketIO(app)

g_ocra_project: OCRAProject = OCRAProject()


def get_project_folder_path() -> str | None:
    project_folder_path = filedialog.askdirectory(
        title="Select project folder...",
    )
    return project_folder_path


@app.route("/")
def index():
    return render_template("index.html", sync_mode=socketio.async_mode)


@socketio.on("open_new_pdf")
def handle_open_new_pdf() -> None:
    global g_ocra_project
    pdf_filetypes = (
        ("PDF", "*.pdf"),
        ("all files", "*.*"),
    )
    pdf_filepath = filedialog.askopenfilename(
        title="Select PDF file...", filetypes=pdf_filetypes
    )
    if not pdf_filepath:
        return
    pdf_filepath = standardize_file_path(file_path=pdf_filepath)

    project_folder_path = get_project_folder_path()
    if not project_folder_path:
        return
    project_folder_path = standardize_folder_path(folder_path=project_folder_path)

    g_ocra_project = OCRAProject()
    g_ocra_project.create_project_from_pdf(
        pdf_file_path=pdf_filepath,
        folder_path=project_folder_path,
    )


@socketio.on("open_project_folder")
def handle_open_ocra_project_folder() -> None:
    global g_ocra_project
    g_ocra_project = OCRAProject()
    project_folder_path = get_project_folder_path()
    if not project_folder_path:
        return
    project_folder_path = standardize_folder_path(folder_path=project_folder_path)
    g_ocra_project.load_ocra_project(folder_path=project_folder_path)
    socketio.emit(
        "data_update",
        g_ocra_project.data_update_json()
    )


@socketio.on("set_changed_image_config")
def handle_set_changed_image_config(config_json) -> None:
    global g_ocra_project
    is_effectively_changed = g_ocra_project.set_changed_image_config_from_json(
        config_json=config_json
    )
    if is_effectively_changed:
        socketio.emit(
            "data_update",
            g_ocra_project.data_update_json()
        )


@socketio.on("set_changed_rects")
def handle_set_changed_rects(rects_json) -> None:
    global g_ocra_project
    g_ocra_project.set_changed_rects_from_json(rects_json=rects_json)


@socketio.on("perform_ocr")
def handle_perform_ocr() -> None:
    global g_ocra_project
    ocr_string = g_ocra_project.perform_ocr()
    socketio.emit(
        "get_ocr",
        ocr_string
    )


@socketio.on("changed_text")
def handle_changed_text(string) -> None:
    global g_ocra_project
    g_ocra_project.set_current_image_transcript(string)


@socketio.on("set_tesseract_path")
def handle_set_tesseract_path() -> None:
    global g_ocra_project
    if system() == "Windows":
        filetypes = (("exe files", "*.exe"), ("all files", "*.*"))
    else:
        filetypes = (("all files", "*.*"),)
    file_path = filedialog.askopenfilename(
        title="Set tesseract executable file...", filetypes=filetypes
    )
    if not file_path:
        return
    file_path = standardize_file_path(file_path=file_path)
    g_ocra_project.change_tesseract_path(tesseract_path=file_path)
    socketio.emit(
        "get_tesseract_path",
        file_path,
    )


@socketio.on("change_tesseract_arguments")
def handle_change_tesseract_arguments(string) -> None:
    global g_ocra_project
    g_ocra_project.change_tesseract_arguments(
        arguments=string
    )


@socketio.on("change_tesseract_languages")
def handle_change_tesseract_languages(json) -> None:
    global g_ocra_project
    g_ocra_project.change_tesseract_languages(
        languages_json=json,
    )

@socketio.on("new_page")
def handle_new_page(number) -> None:
    global g_ocra_project
    g_ocra_project.move_to_page(new_page=number)
    socketio.emit(
        "data_update",
        g_ocra_project.data_update_json()
    )

# MAIN ROUTINE SECTION #
if __name__ == "__main__":
    # selection = input(
    #     "Do you want to propagate the server in your whole network\n"
    #     "so that it can be accessed by other network devices\n"
    #     "(WARNING: If you cannot fully trust the network, this\n"
    #     " may pose an additional security risk!)? [type in Y for yes,\n"
    #     "and any other symbol for no, followed by pressing ENTER] "
    # )

    # We use the address 0.0.0.0 in order to propagate
    # the server in our local network. If you only want
    # to use the server on your hosting device only, use
    # the address 127.0.0.1.
    # Flask's default port number is 5000.
    # if selection == "Y":
    #     host = "0.0.0.0"
    # else:
    host = "127.0.0.1"

    port = 5000
    if os.path.isfile("./cert.pem") and os.path.isfile("./key.pem"):
        socketio.run(app, host=host, port=port, ssl_context=("cert.pem", "key.pem"))
    else:
        socketio.run(app, host=host, port=port)
