"""The OCRA project class definition."""

# IMPORTS SECTION #
## EXTERNAL IMPORTS ##
import base64
import fitz
import os
import pytesseract
from io import BytesIO
from PIL import Image
from pydantic import BaseModel
from pydantic.tools import parse_obj_as
from shutil import copy
from time import sleep
from typing import Any

## INTERNAL IMPORTS ##
from utils import (
    ensure_folder_existence,
    get_filenames_of_folder,
    is_file_existing,
    json_load,
    json_write,
    standardize_file_path,
    standardize_folder_path,
)


# UTILITY CLASS DEFINITIONS SECTION #
class Rect(BaseModel):
    """Represents a rectangle which marks an area which shall be OCRed."""

    coord_x: int
    """The Rect's upper left X coordinate in DPI-dependent pixels.."""
    coord_y: int
    """The Rect's upper left Y coordinate in DPI-dependent pixels.."""
    width: int
    """The Rect's width (X axis) in DPI-dependent pixels."""
    height: int
    """The Rect's height (Y axis) in DPI-dependent pixels."""
    language_state: str
    """Marks if the language '1', '2' or '1_and_2' are marked. TODO: Replace by enum"""


class ImageConfig(BaseModel):
    """The general image settings of a shown PDF page."""

    x_zoom: int = 25
    """The PDF page's X axis zoom factor in %. Does not affect the X/Y coordinates."""
    y_zoom: int = 25
    """The PDF page's Y zoom factor in %. Does not affect the X/Y coordinates."""
    rotation: int = 0
    """The PDF page rotation in degrees (°). Can be positive or negative."""
    is_binarized: bool = False
    """If true, only black and white are shown. If false, all colors are possible."""
    binarization_threshold: int = 130
    """Sets the threshold for binarization. Only effective if is_binarized is True."""
    dpi: int = 500
    """The PDF page's DPI resolution. Affects the X/Y coordinates so that rects usually have to be redrawn."""
    rects: list[Rect] = []
    """The list of all OCR rectangles of the page."""


class TesseractConfig(BaseModel):
    """Represents the OCRA-supported Tesseract settings (i.e., command-line arguments)."""

    command_path: str = ""
    """Full path to the Tesseract executable. Has to be set by the user for each analyzed PDF."""
    extra_arguments: str = ""
    """Extra arguments for Tesseract. Can be any Tesseract argument as it is written to the console."""
    language_1: str = ""
    """The language (in Tesseract format) of the Rects which are set for the 'language 1'."""
    language_2: str = ""
    """The language (in Tesseract format) of the Rects which are set for the 'language 1'."""


# MAIN CLASS DEFINITION SECTION #
class OCRAProject:
    """Main OCRA class containing all major functions and project-representing member variables."""

    def __init__(self):
        """Start-up of all project-representing member variables."""
        self.folder_path: str = ""
        """The OCRA project's full folder path."""
        self.current_image_config: ImageConfig = ImageConfig()
        """The OCRA project's ImageConfig instance."""
        self.tesseract_config: TesseractConfig = TesseractConfig()
        """The OCRA project's TesseractConfig instance."""
        self.current_page: int = 1
        """The currently viewed and editable page's number."""
        self.pdf_document = fitz.Document()
        """The mupdf (i.e., fitz) instance of the currently opened PDF page."""

    ## GET FOLDER PATHS SECTION ##
    def get_image_configs_path(self) -> str:
        """Returns the current full image config folder's path.


        Returns:
            str: The current full image config folder's path.
        """
        return standardize_folder_path(folder_path=f"{self.folder_path}image_configs/")

    def get_image_transcripts_path(self) -> str:
        """Returns the current full image transcript folder's path.


        Returns:
            str: The current full image transcript folder's path.
        """
        return standardize_folder_path(
            folder_path=f"{self.folder_path}image_transcripts/"
        )

    def get_rect_images_path(self) -> str:
        """Returns the current full rect images folder's path.


        Returns:
            str: The current full rect images folder's path.
        """
        return standardize_folder_path(folder_path=f"{self.folder_path}rect_images/")

    def get_transformed_images_path(self) -> str:
        """Returns the current full transformed images folder's path.


        Returns:
            str: The current full transformed images folder's path.
        """
        return standardize_folder_path(
            folder_path=f"{self.folder_path}transformed_images/"
        )

    ## GET FILE PATHS SECTION ##
    def get_current_image_config_file_path(self) -> str:
        """Returns the full path of the current page's ImageConfig JSON file.

        Returns:
            str: The current page's ImageConfig JSON file path.
        """
        return f"{self.get_image_configs_path()}{self.current_page}.json"

    def get_current_image_transcript_file_path(self) -> str:
        """Returns the full path of the current page's transcript text file.

        Returns:
            str: The current page's transcript page file path.
        """
        return f"{self.get_image_transcripts_path()}{self.current_page}.txt"

    def get_current_page_file_path(self) -> str:
        """Returns the full path of the JSON file containing the project's current page number.

        Returns:
            str: The full path of the JSON file containing the project's current page number.
        """
        return standardize_file_path(file_path=f"{self.folder_path}current_page.json")

    def get_current_rect_image_path(self, rect_number: int) -> str:
        """Returns the full path of the image file representing the given Rect's area.

        Args:
            rect_number (int): The Rect's index in the current ImageConfig's Rect list.

        Returns:
            str: Full path of the image file representing the given Rect's area.
        """
        return f"{self.get_rect_images_path()}{self.current_page}_{rect_number}.png"

    def get_current_transformed_image_file_path(self) -> str:
        """Returns the full path of the image file representing the user-settings-transformed current page.

        Returns:
            str: Full path of the image file representing the user-settings-transformed current page.
        """
        return standardize_file_path(
            file_path=f"{self.get_transformed_images_path()}{self.current_page}.png"
        )

    def get_existing_current_rect_images(self) -> list[str]:
        """Returns full paths of all images which represent the user-made Rects of the current page.

        Returns:
            list[str]: A list of full paths of all images which represent the user-made Rects of the current page.
        """
        return [
            x
            for x in get_filenames_of_folder(folder_path=self.get_rect_images_path())
            if x.startswith(str(self.current_page) + "_")
        ]

    def get_project_pdf_file_path(self) -> str:
        """Returns the current project's PDF full path.

        The file itself is always called 'file.pdf'.

        Returns:
            str: The current project's PDF full path.
        """
        return f"{self.folder_path}file.pdf"

    def get_tesseract_config_file_path(self) -> str:
        """Returns the current project's TesseractConfig JSON file path.

        The file itself is always called 'tesseract_config.json'.

        Returns:
            str: The current project's TesseractConfig JSON file path.
        """
        return standardize_file_path(
            file_path=f"{self.folder_path}tesseract_config.json"
        )

    ## ENSURE FILE EXISTENCE SECTION ##
    def ensure_current_image_config(self) -> None:
        """Ensures that an ImageConfig JSON file exists for the current project.

        I.e., if none exists, a new empty one with standard values is created.
        """
        if not is_file_existing(filepath=self.get_current_image_config_file_path()):
            self.current_image_config = ImageConfig()
            self.write_current_image_config()

    def ensure_current_transformed_image_existence(self) -> None:
        """Ensures that the current transformed PDF page's image exists.

        I.e., if none exists, a new one with the transformation is created.
        """
        if not is_file_existing(
            filepath=self.get_current_transformed_image_file_path()
        ):
            self.transform_current_image()

    ## GET CURRENT FILES SECTION ##
    def get_current_image_config(self) -> ImageConfig:
        """Returns the current ImageConfig from the image config JSON of the current project.

        Returns:
            ImageConfig: The current PDF page image configuration.
        """
        return parse_obj_as(
            ImageConfig, json_load(file_path=self.get_current_image_config_file_path())
        )

    def get_current_image_transcript(self) -> str:
        """Returns the current full page OCR transcript text.

        Returns:
            str: The current full page OCR transcript text.
        """
        transcript_path = self.get_current_image_transcript_file_path()
        if is_file_existing(filepath=transcript_path):
            with open(transcript_path, "r", encoding="utf-8") as f:
                text = f.read()
        else:
            text = ""
        return text

    ## WRITE FILES SECTION ##
    def write_current_image_config(self) -> None:
        """Weites the current ImageConfig as JSON file."""
        json_write(
            file_path=self.get_current_image_config_file_path(),
            json_data=self.current_image_config.dict(),
        )

    def write_current_page(self) -> None:
        """Writes the current page number in its associated JSON file."""
        json_write(
            file_path=self.get_current_page_file_path(), json_data=self.current_page
        )

    def write_tesseract_config(self) -> None:
        """Writes the current TesseractConfig in its associated JSON file."""
        with open(self.get_tesseract_config_file_path(), "w", encoding="utf-8") as f:
            f.write(self.tesseract_config.json())

    def set_current_image_transcript(self, text: str) -> None:
        """Sets the current page's text transcript to the given text and stores it in its text file.

        Args:
            text (str): The changed (new) text transcript.
        """
        with open(
            self.get_current_image_transcript_file_path(), "w", encoding="utf-8"
        ) as f:
            f.write(text)

    ## MAIN FUNCTIONS SECTION ##
    def change_tesseract_arguments(self, *, arguments: str) -> None:
        """Changes the current Tesseract config by re-writing the associated file.

        Args:
            arguments (str): The changed (new) Tesseract arguments.
        """
        self.tesseract_config.extra_arguments = arguments
        self.write_tesseract_config()

    def change_tesseract_languages(self, *, languages_json: dict[str, str]) -> None:
        """Changes the current Tesseract languages by re-writing the associated file.

        Args:
            languages_json (dict[str, str]): Dictionary containing the language data.
        """
        self.tesseract_config.language_1 = languages_json["language_1"]
        self.tesseract_config.language_2 = languages_json["language_2"]
        self.write_tesseract_config()

    def change_tesseract_path(self, *, tesseract_path: str) -> None:
        """Changes the current Tesseract executable path by re-writing the associated file.

        Args:
            tesseract_path (str): The changed (new) Tesseract executable path.
        """
        self.tesseract_config.command_path = tesseract_path
        self.write_tesseract_config()

    def create_project_from_pdf(self, *, pdf_file_path: str, folder_path: str) -> None:
        """Creates a new project from a PDF by generating the OCRA project files in the given folder.

        Args:
            pdf_file_path (str): The original PDF file's path.
            folder_path (str): The OCRA project's path.
        """
        pdf_file_path = standardize_file_path(file_path=pdf_file_path)
        folder_path = standardize_folder_path(folder_path=folder_path)

        ensure_folder_existence(folder_path=folder_path)
        self.folder_path = folder_path

        pdf_destination = self.get_project_pdf_file_path()
        copy(pdf_file_path, pdf_destination)

        ensure_folder_existence(folder_path=f"{self.folder_path}")
        ensure_folder_existence(folder_path=self.get_transformed_images_path())
        ensure_folder_existence(folder_path=self.get_image_transcripts_path())
        ensure_folder_existence(folder_path=self.get_rect_images_path())
        ensure_folder_existence(folder_path=self.get_image_configs_path())

        self.tesseract_config = TesseractConfig()
        self.write_tesseract_config()
        self.current_page = 1
        self.write_current_page()
        self.current_image_config = ImageConfig()
        self.ensure_current_image_config()
        self.write_current_image_config()

        self.load_ocra_project(folder_path=folder_path)

    def create_rect_images(self) -> None:
        """Creates images of all Rects from the transformed PDF page image and stores them.

        These files are later used for OCR with Tesseract.
        """
        self.ensure_current_transformed_image_existence()
        for file in self.get_existing_current_rect_images():
            while not os.access(self.get_rect_images_path() + file, mode=os.W_OK):
                sleep(0.1)
            os.remove(self.get_rect_images_path() + file)
        image = Image.open(self.get_current_transformed_image_file_path())
        rect_counter = 0
        for rect in self.current_image_config.rects:
            if rect.width >= 0.0:
                x_upper_left = rect.coord_x
                x_lower_right = rect.coord_x + rect.width
            else:
                x_upper_left = rect.coord_x + rect.width
                x_lower_right = rect.coord_x
            if rect.height >= 0.0:
                y_upper_left = rect.coord_y
                y_lower_right = rect.coord_y + rect.height
            else:
                y_lower_right = rect.coord_y
                y_upper_left = rect.coord_y + rect.height
            cropped_image = image.crop(
                (x_upper_left, y_upper_left, x_lower_right, y_lower_right)
            )
            cropped_image.save(self.get_current_rect_image_path(rect_counter))
            rect_counter += 1
        image.close()

    def data_update_json(self) -> dict[str, Any]:
        """Returns a full data update for all Rects and the image in base64 format.

        Returns:
            dict[str, Any]: The full data update.
        """
        image = Image.open(self.get_current_transformed_image_file_path())
        buffer = BytesIO()
        image.save(buffer, format="PNG")
        base64_str = "data:image/png;base64," + base64.b64encode(
            buffer.getvalue()
        ).decode("utf-8")
        image.close()

        rects = []
        for rect in self.current_image_config.rects:
            rects.append(
                {
                    "x": rect.coord_x,
                    "y": rect.coord_y,
                    "w": rect.width,
                    "h": rect.height,
                    "language_state": rect.language_state,
                }
            )
        data_update_json = {
            "page_number": len(self.pdf_document),
            "current_page": self.current_page,
            "tesseract_path": self.tesseract_config.command_path,
            "tesseract_arguments": self.tesseract_config.extra_arguments,
            "tesseract_language_1": self.tesseract_config.language_1,
            "tesseract_language_2": self.tesseract_config.language_2,
            "x_zoom": self.current_image_config.x_zoom,
            "y_zoom": self.current_image_config.y_zoom,
            "text": self.get_current_image_transcript(),
            "rotation": self.current_image_config.rotation,
            "dpi": self.current_image_config.dpi,
            "is_binarized": self.current_image_config.is_binarized,
            "binarization_threshold": self.current_image_config.binarization_threshold,
            "rects": rects,
            "image_base64": base64_str,
        }
        return data_update_json

    def load_ocra_project(self, *, folder_path: str) -> None:
        """Load an already existing OCRA project from its folder.

        Args:
            folder_path (str): The OCRA project's folder path.
        """
        folder_path = standardize_folder_path(folder_path=folder_path)
        self.folder_path = folder_path

        pdf_destination = self.get_project_pdf_file_path()
        self.pdf_document = fitz.open(pdf_destination)

        self.tesseract_config = parse_obj_as(
            TesseractConfig, json_load(file_path=self.get_tesseract_config_file_path())
        )
        self.current_page: int = json_load(file_path=self.get_current_page_file_path())
        self.current_image_config = self.get_current_image_config()

        self.ensure_current_transformed_image_existence()

    def move_to_page(self, *, new_page: int) -> None:
        """Loads the content and settings of the new page (or creates it if not already existing).

        Args:
            new_page (int): The new page's number.
        """
        self.current_page = new_page
        self.ensure_current_transformed_image_existence()
        self.ensure_current_image_config()
        self.write_current_page()
        self.current_image_config = self.get_current_image_config()
        self.data_update_json()

    def perform_ocr(self) -> str:
        """Performs a Tesseract OCR on the current page with the current settings.

        Returns:
            str: The OCR result text.
        """
        get_lang_string = lambda string: string if (string != "") else "eng"

        pytesseract.pytesseract.tesseract_cmd = self.tesseract_config.command_path
        self.create_rect_images()
        rect_image_paths = self.get_existing_current_rect_images()
        ocr_string = f"~PAGE {self.current_page}~\n"
        rect_counter = 0
        for rect_image_path in rect_image_paths:
            rect_image_path = self.get_rect_images_path() + rect_image_path
            current_rect = self.current_image_config.rects[rect_counter]
            if current_rect.language_state == "1":
                lang = get_lang_string(self.tesseract_config.language_1)
            elif current_rect.language_state == "2":
                lang = get_lang_string(self.tesseract_config.language_2)
            elif current_rect.language_state == "1_and_2":
                lang = (
                    get_lang_string(self.tesseract_config.language_1)
                    + "+"
                    + get_lang_string(self.tesseract_config.language_2)
                )
            config = self.tesseract_config.extra_arguments
            with Image.open(rect_image_path) as rect_image:
                tesseract_result = pytesseract.image_to_string(
                    image=rect_image, lang=lang, config=config
                )
            ocr_string += f"↓↓↓↓↓START RECT # {rect_counter}\n"
            ocr_string += tesseract_result
            ocr_string += f"↑↑↑↑↑END RECT # {rect_counter}\n"
            rect_image.close()
            rect_counter += 1
        return ocr_string

    def set_changed_image_config_from_json(
        self, *, config_json: dict[str, float | int | bool]
    ) -> bool:
        """Sets the changed ImageConfig according to the given JSON.

        Args:
            config_json (dict[str, float  |  int  |  bool]): The changed (new) ImageConfig.

        Returns:
            bool: Is true if there is a real, effective change. Otherwise, it is false.
        """
        new_image_config = ImageConfig(
            x_zoom=config_json["x_zoom"] * 100,
            y_zoom=config_json["y_zoom"] * 100,
            rotation=config_json["rotation"],
            is_binarized=config_json["is_binarized"],
            binarization_threshold=config_json["binarization_threshold"],
            dpi=config_json["dpi"],
            rects=self.current_image_config.rects,
        )

        is_effectively_changed = False
        if new_image_config.rotation != self.current_image_config.rotation:
            is_effectively_changed = True
        if new_image_config.is_binarized != self.current_image_config.is_binarized:
            is_effectively_changed = True
        if (
            new_image_config.binarization_threshold
            != self.current_image_config.binarization_threshold
        ):
            is_effectively_changed = True
        if new_image_config.dpi != self.current_image_config.dpi:
            is_effectively_changed = True

        self.current_image_config = new_image_config
        self.write_current_image_config()
        if not is_effectively_changed:
            return False

        self.transform_current_image()
        return True

    def set_changed_rects_from_json(self, *, rects_json: dict[str, float]) -> None:
        """Set the Rects of the current page according to the ones from the given JSON.

        Args:
            rects_json (dict[str, float]): A JSON describing the new Rects list.
        """
        new_rects: list[Rect] = []
        for json_rect in rects_json:
            new_rect = Rect(
                coord_x=json_rect["x"],
                coord_y=json_rect["y"],
                width=json_rect["w"],
                height=json_rect["h"],
                language_state=json_rect["language_state"],
            )
            new_rects.append(new_rect)
        self.current_image_config.rects = new_rects
        self.write_current_image_config()

    def transform_current_image(self) -> None:
        """Transforms the current PDF page's image according to the user settings."""
        self.ensure_current_image_config()

        image_path = self.get_current_transformed_image_file_path()

        page = self.pdf_document.load_page(self.current_page - 1)
        image = page.get_pixmap(
            matrix=fitz.Matrix(
                self.current_image_config.dpi / 72, self.current_image_config.dpi / 72
            )
        )

        image.save(image_path)
        image = Image.open(image_path)
        image = image.rotate(self.current_image_config.rotation)
        if self.current_image_config.is_binarized:
            image = image.convert("1", dither=Image.NONE)
            image = image.point(
                lambda p: p > self.current_image_config.binarization_threshold and 255
            )

        image.save(image_path)
        image.close()
