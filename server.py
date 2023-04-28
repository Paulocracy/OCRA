"""Main script of the OCRA Flask&Socket.IO server.

The server has its own global instance of OCRAproject,
and stores all data coming from the browser there. All
data shown in the browser is also stored and handled
in the OCRAproject instance.
"""

# IMPORTS SECTION #
## EXTERNAL IMPORTS ##
import os
from platform import system
from flask import Flask, render_template
from flask_socketio import SocketIO
from tkinter import filedialog
from typing import Any

## INTERNAL IMPORTS ##
from ocra import OCRAProject
from utils import standardize_file_path, standardize_folder_path


# GLOBAL VARIABLES SECTION #
## SOCKET.IO GLOBAL VARIABLES ##
async_mode = None
app = Flask(__name__)
app.config["SECRET_KEY"] = "secret!"
socketio = SocketIO(app)
## OCRA global variable
g_ocra_project: OCRAProject = OCRAProject()


# FUNCTION DEFINITIONS SECTION #
## General utility functions ##
def get_project_folder_path() -> str | None:
    """Using tkinter, the user is asked to choose an OCRA project folder path.

    Returns:
        str | None: The full OCRA project folder path. Is None if the user did not select one.
    """
    project_folder_path = filedialog.askdirectory(
        title="Select project folder...",
    )
    return project_folder_path


## CLIENT<->SERVER<->CLIENT COMMUNICATION FUNCTIONS ##
@app.route("/")
def index() -> str:
    """Loads the main HTML file.

    Returns:
        _type_: Flask-internal return.
    """
    return render_template("index.html", sync_mode=socketio.async_mode)


@socketio.on("new_page")
def handle_new_page(number: int) -> None:
    """Handles going to a different page in the current project's PDF.

    Args:
        number (int): The new page's number in the PDF
    """
    global g_ocra_project
    g_ocra_project.move_to_page(new_page=number)
    socketio.emit("data_update", g_ocra_project.data_update_json())


@socketio.on("open_project_folder")
def handle_open_ocra_project_folder() -> None:
    """Handles opening an OCRA project folder and its contents."""
    global g_ocra_project
    g_ocra_project = OCRAProject()
    project_folder_path = get_project_folder_path()
    if not project_folder_path:
        return
    project_folder_path = standardize_folder_path(folder_path=project_folder_path)
    g_ocra_project.load_ocra_project(folder_path=project_folder_path)
    socketio.emit("data_update", g_ocra_project.data_update_json())


@socketio.on("perform_ocr")
def handle_perform_ocr() -> None:
    """Handles performing a Tesseract OCR of the current page's Rects."""
    global g_ocra_project
    ocr_string = g_ocra_project.perform_ocr()
    socketio.emit("get_ocr", ocr_string)


@socketio.on("set_changed_image_config")
def handle_set_changed_image_config(config_json: dict[str, Any]) -> None:
    """Sets the new changed current PDF page image confic in the OCRA project instance.

    Args:
        config_json (dict[str, Any]): The new image config, as detailed in data_update_json()
         of OCRAProject.
    """
    global g_ocra_project
    is_effectively_changed = g_ocra_project.set_changed_image_config_from_json(
        config_json=config_json
    )
    if is_effectively_changed:
        socketio.emit("data_update", g_ocra_project.data_update_json())


@socketio.on("set_tesseract_path")
def handle_set_tesseract_path() -> None:
    """Opens a tkinter dialog for the user to choose a new Tesseract path.

    This path should be, under Windows, the Tesseract .exe, otherwise,
    a path to an executable Tesseract executable.
    """
    global g_ocra_project

    # Set file type according to operating system
    if system() == "Windows":
        filetypes = (("exe files", "*.exe"), ("all files", "*.*"))
    else:
        filetypes = (("all files", "*.*"),)

    # Ask for file path to Tesseract executable
    file_path = filedialog.askopenfilename(
        title="Set tesseract executable file...", filetypes=filetypes
    )
    # If no path is chosen, do nothing
    if not file_path:
        return

    # Set the Tesseract path in the project
    file_path = standardize_file_path(file_path=file_path)
    g_ocra_project.change_tesseract_path(tesseract_path=file_path)

    # Send the chosen Tesseract path back to the browser so that it
    # can be displayed there.
    socketio.emit(
        "get_tesseract_path",
        file_path,
    )


## CLIENT->SERVER COMMUNICATION FUNCTIONS ##
@socketio.on("change_tesseract_arguments")
def handle_change_tesseract_arguments(string: str) -> None:
    """Catches the signal to change the Tesseract arguments and sends it to the main class.

    Args:
        string (str): The newly set Tesseract arguments which will overwrite the old ones.
    """
    global g_ocra_project
    g_ocra_project.change_tesseract_arguments(arguments=string)


@socketio.on("change_tesseract_languages")
def handle_change_tesseract_languages(json: dict[str, str]) -> None:
    """Catches the signal to change the Tesseract arguments, sending it to the main class.

    Args:
        json (dict[str, str]): A dictionary of the following structure:
        {
            "language_1": "$LANGUAGE_1",
            "language_2": "$LANGUAGE_1",
        }
        where "$LANGUAGE_1" and "$LANGUAGE_2" shall be but do not have to be
        valid Tesseract language identifiers.
    """
    global g_ocra_project
    g_ocra_project.change_tesseract_languages(
        languages_json=json,
    )


@socketio.on("changed_text")
def handle_changed_text(string: str) -> None:
    """Sends the changed image text (i.e., transcript) to the main class.

    Args:
        string (str): The new image transcript text, including all
        line breaks.
    """
    global g_ocra_project
    g_ocra_project.set_current_image_transcript(string)


@socketio.on("open_new_pdf")
def handle_open_new_pdf() -> None:
    """ Opens tkinter dialogs to create a new OCRA project from a PDF file.

    Firstly, the user selects the PDF file through a tkinter dialog.
    Secondly, the user selects the folder for the new OCRA project to the
    tkinter dialog.
    Thirdly, The OCRA project is created in the given location.
    Lastly, the new OCRA project is sent to the server to be displayed.
    """
    global g_ocra_project

    # Select PDF file
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

    # Select new OCRA project file
    project_folder_path = get_project_folder_path()
    if not project_folder_path:
        return
    project_folder_path = standardize_folder_path(folder_path=project_folder_path)

    # Create new OCRA project in selected location
    g_ocra_project = OCRAProject()
    g_ocra_project.create_project_from_pdf(
        pdf_file_path=pdf_filepath,
        folder_path=project_folder_path,
    )

    # Send back new OCRA project so that it is displayed
    socketio.emit("data_update", g_ocra_project.data_update_json())


@socketio.on("set_changed_rects")
def handle_set_changed_rects(rects_json: dict[str, Any]) -> None:
    """Sets the changed drawn rects sent from the server in the OCRA project.

    Args:
        rects_json (dict[str, Any]): A dictionary of the form as described
        in OCRAProject's set_changed_rects_from_json() function.
    """
    global g_ocra_project
    g_ocra_project.set_changed_rects_from_json(rects_json=rects_json)


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
        print(f"Open OCRA in https://{host}:{port}")
        socketio.run(app, host=host, port=port, ssl_context=("cert.pem", "key.pem"))
    else:
        print(f"Open OCRA in http://{host}:{port}")
        socketio.run(app, host=host, port=port)
