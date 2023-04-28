"""Small file I/O utility helper functions for OCRA.

These functions include ones for JSON handling, path
standardization and more.
"""

# IMPORTS SECTION #
import json
import os
from typing import Any


# PUBLIC FUNCTIONS SECTION #
def ensure_folder_existence(*, folder_path: str) -> None:
    """Checks if the given folder exists. If not, the folder is created.

    Argument
    ----------
    * folder_path: str ~ The folder whose existence shall be enforced.
    """
    folder_path = standardize_folder_path(folder_path=folder_path)
    if os.path.isdir(folder_path):
        return
    os.makedirs(folder_path)


def get_filenames_of_folder(*, folder_path: str) -> list[str]:
    """Returns the names of the files in the given folder as a list of strings.

    Arguments
    ----------
    * folder_path: str ~ The path to the folder of which the file names shall be returned
    """
    folder_path = standardize_folder_path(folder_path=folder_path)
    files: list[str] = []
    for _, _, filenames in os.walk(folder_path):
        files.extend(filenames)
    files = [standardize_file_path(file_path=x) for x in files]
    return files


def is_file_existing(*, filepath: str) -> bool:
    """Checks if the given folder exists.

    Argument
    ----------
    * filepath: str ~ The file whose existence shall be checked.
    """
    filepath = standardize_file_path(file_path=filepath)
    if os.path.isfile(filepath):
        return True
    else:
        return False


def json_load(*, file_path: str) -> Any:
    """Loads the given JSON file and returns it as json_data (a list
    or a dictionary).

    Arguments
    ----------
    * path: str ~ The path of the JSON file
    """
    with open(file_path) as f:
        json_data = json.load(f)
    return json_data


def json_write(*, file_path: str, json_data: Any) -> None:
    """Writes a JSON file at the given path with the given dictionary as content.

    Arguments
    ----------
    * path: str ~  The path of the JSON file that shall be written
    * json_data: Any ~ The dictionary or list which shalll be the content of
      the created JSON file
    """
    json_output = json.dumps(json_data, indent=4)
    with open(file_path, "w+", encoding="utf-8") as f:
        f.write(json_output)


def standardize_file_path(*, file_path: str) -> str:
    file_path = file_path.replace("\\", "/")
    return file_path


def standardize_folder_path(
    *, folder_path: str, enforced_ending: str | None = "/"
) -> str:
    """Returns for the given folder path is returned in a more standardized way.

    I.e., folder paths with potential \\ are replaced with /. In addition, if
    a path does not end with / will get an added /.

    Argument
    ----------
    * folder_path: str ~ The folder path that shall be standardized.
    """
    # Standardize for \ or / as path separator character.
    folder_path = folder_path.replace("\\", "/")

    # If the last character is not a path separator, it is
    # added so that all standardized folder path strings
    # contain it.
    if enforced_ending is not None:
        if folder_path[-1] != enforced_ending:
            folder_path += enforced_ending

    return folder_path
