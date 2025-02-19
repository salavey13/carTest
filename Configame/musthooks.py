from flask import request, jsonify
# musthooks.py
import shutil
import os
import sys
import pythoncom
from win32com.shell import shell, shellcon
import subprocess
import time
import uuid
from datetime import datetime
import winreg
import webbrowser
import json
from tkinter import filedialog
import requests
from utils import publish_event  # Import from utils
import threading

installation_lock = threading.Lock()


    
# load_projects                     +
# load_config                       +
# apply_zip_updates                 +
# download_and_install              +
# save_config                       +
# run_command                       +
# create_project                    +
# switch_project                    +
# mark_step_completed               +
# generate_installation_achievement +
# clone_repository                  +
# is_tool_installed                 +
# is_npm_package_installed          +
# ensure_v0_projects_dir            +
# ensure_default_project            +
# pull_git_updates                  +
# check_git_status                  +
# get_npm_path                      +
# update_environment_variable       +
# verify_github_login               +
# guide_user_to_create_github_token +
# install_cli_tool                  +
# create_project_folder             +
# initialize_login_checklist        +                  


# Configuration
PROJECTS_DIR = os.path.expanduser("~/Documents/V0_Projects")
DEFAULT_PROJECT_NAME = "cartest"  # Default project name
REPO_DIR = os.path.join(PROJECTS_DIR, DEFAULT_PROJECT_NAME)  # Dynamic repo path
V0_DEV_URL = "https://v0.dev/chat/cartest-tupabase-template-hdQdrfzkTFA?b=b_I9SSuPzTot2&p=0"
VERCEL_URL = "https://vercel.com"
SUPABASE_URL = "https://supabase.com"
GITHUB_URL = f"https://github.com/salavey13/{DEFAULT_PROJECT_NAME}"
#TEMP_DIR = os.path.join(os.getenv("TEMP"), "setup_temp")
# URLs for downloads
DOWNLOAD_URLS = {
    "Git": "https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.2/Git-2.47.1.2-64-bit.exe",
    "Node.js": "https://nodejs.org/dist/v22.13.1/node-v22.13.1-x64.msi",
    "Notepad++": "https://github.com/notepad-plus-plus/notepad-plus-plus/releases/download/v8.7.6/npp.8.7.6.Installer.x64.exe",
    "VS Code": "https://code.visualstudio.com/sha/download?build=stable&os=win32-x64-user",
}




    
def update_environment_variable(key, value):
    """
    Update the environment variable for the current session and persist it in the Windows registry.
    """
    # Update for the current session
    os.environ[key] = value
    
    try:
        # Open the registry key for environment variables
        reg_key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            "Environment",
            0,
            winreg.KEY_SET_VALUE
        )
        
        # Set the environment variable in the registry
        winreg.SetValueEx(reg_key, key, 0, winreg.REG_SZ, value)
        winreg.CloseKey(reg_key)
        
        # Notify the system of the environment change
        windll.user32.SendMessageW(0xFFFF, 0x1A, 0, 0)  # Broadcast WM_SETTINGCHANGE
        
        return json.dumps({
            "status": "success",
            "message": f"Environment variable {key} updated and saved."
        })
    except Exception as e:
        return json.dumps({
            "status": "error",
            "message": f"Failed to save environment variable: {str(e)}"
        })

def verify_github_login():
    """
    Verify if the GitHub token is set in the environment variables.
    If not, guide the user to create one and optionally update the environment.
    """
    github_token = os.getenv("GITHUB_TOKEN")
    
    if github_token:
        # Token found, mark GitHub as completed
        config["github"] = "completed"
        save_config(current_project, config)
        return json.dumps({
            "status": "success",
            "message": "GitHub successfully configured!"
        })
    else:
        return json.dumps({
            "status": "info",
            "message": "GitHub token not found. Please configure it manually."
        })

def guide_user_to_create_github_token():
    """
    Guide the user step-by-step to create a GitHub Personal Access Token (PAT).
    """
    instructions = (
        "To create a GitHub token:\n"
        "1. Go to GitHub settings: https://github.com/settings/tokens\n"
        "2. Click 'Generate new token'.\n"
        "3. Select necessary permissions (e.g., repo, read:org).\n"
        "4. Copy the generated token (you won't see it again!).\n\n"
        "Would you like us to automatically update your GITHUB_TOKEN environment variable?"
    )
    
    return json.dumps({
        "status": "info",
        "message": instructions
    })

def pull_git_updates():
    try:
        subprocess.run(["git", "pull"], check=True)
        generate_installation_achievement("Git Update Pulled", current_project)
        return json.dumps({
            "status": "success",
            "message": "Updates applied successfully!"
        })
    except subprocess.CalledProcessError as e:
        return json.dumps({
            "status": "error",
            "message": f"Failed to apply updates: {e.stderr}"
        })

def install_cli_tool(tool_name, current_project):
    config = load_config(current_project)
    
    # Check if the tool is already installed
    if tool_name.lower() in config.get("TOOLS_INSTALLED", []):
        return json.dumps({
            "status": "info",
            "message": f"{tool_name} is already installed."
        })
    
    # Ensure Node.js and npm are installed
    if not is_tool_installed("node"):
        return json.dumps({
            "status": "error",
            "message": "Node.js must be installed before installing this tool."
        })
    
    try:
        # Get the full path to npm
        npm_path = get_npm_path()
        
        # Install globally if supported
        if tool_name.lower() != "supabase":
            subprocess.run([npm_path, "install", "-g", tool_name], check=True)
            config.setdefault("TOOLS_INSTALLED", []).append(tool_name.lower())
            save_config(current_project, config)
            message = f"{tool_name} installed globally."
        else:
            # Install Supabase CLI locally
            project_dir = os.path.join(PROJECTS_DIR, current_project)
            if not os.path.exists(project_dir):
                return json.dumps({
                    "status": "error",
                    "message": "Project folder does not exist."
                })
            subprocess.run([npm_path, "install", tool_name], cwd=project_dir, check=True)
            config.setdefault("TOOLS_INSTALLED", []).append(tool_name.lower())
            save_config(current_project, config)
            message = f"{tool_name} installed locally in the project folder."
        
        generate_installation_achievement(f"{tool_name} CLI Installed", current_project)
        return json.dumps({
            "status": "success",
            "message": message
        })
    except subprocess.CalledProcessError as e:
        return json.dumps({
            "status": "error",
            "message": f"Failed to install {tool_name}: {e.stderr}"
        })

def is_npm_package_installed(package_name, current_project):
    config = load_config(current_project)
    task_key = f"{package_name.lower()}_installed"
    
    # Check if the installation status is cached
    if task_key in config and config[task_key] == "True":
        return json.dumps({
            "status": "success",
            "message": f"{package_name} is already installed."
        })
    
    try:
        # Get the full path to npm
        npm_path = get_npm_path()
        
        # Step 1: Check globally installed packages
        try:
            result = subprocess.run(
                [npm_path, "list", "-g", "--depth=0"],
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            is_globally_installed = package_name in result.stdout
            if is_globally_installed:
                config[task_key] = "True"
                save_config(current_project, config)
                return json.dumps({
                    "status": "success",
                    "message": f"{package_name} is globally installed."
                })
        except subprocess.CalledProcessError as e:
            print(f"Failed to list globally installed npm packages: {e.stderr}")
        
        # Step 2: Check locally installed packages (within the project directory)
        project_dir = os.path.join(PROJECTS_DIR, current_project)
        if os.path.exists(os.path.join(project_dir, "package.json")):
            try:
                result = subprocess.run(
                    [npm_path, "list", "--depth=0"],
                    cwd=project_dir,  # Ensure we're in the project directory
                    check=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True
                )
                is_locally_installed = package_name in result.stdout
                if is_locally_installed:
                    config[task_key] = "True"
                    save_config(current_project, config)
                    return json.dumps({
                        "status": "success",
                        "message": f"{package_name} is locally installed."
                    })
            except subprocess.CalledProcessError as e:
                print(f"Failed to list locally installed npm packages: {e.stderr}")
        
        # If no checks succeeded, return False
        return json.dumps({
            "status": "info",
            "message": f"{package_name} is not installed."
        })
    except Exception as e:
        return json.dumps({
            "status": "error",
            "message": f"Error checking installation of package {package_name}: {str(e)}"
        })
        
def get_npm_path():
    node_path = shutil.which("node")
    if not node_path:
        raise FileNotFoundError("Node.js is not installed or not found in PATH.")
    
    npm_path = node_path.replace("node.exe", "npm.cmd")
    if not os.path.exists(npm_path):
        node_dir = os.path.dirname(node_path)
        potential_npm = os.path.join(node_dir, "npm.cmd")
        if os.path.exists(potential_npm):
            npm_path = potential_npm
        else:
            raise FileNotFoundError(f"npm not found at the expected location: {npm_path}")

    return npm_path

def is_tool_installed(tool_name, current_project=None):
    config = load_config(current_project) if current_project else {}
    task_key = f"{tool_name.lower()}_installed"

    if task_key in config and config[task_key] == "True":
        return True

    try:
        if tool_name.lower() in ["node", "nodejs"]:
            result = subprocess.run(["node", "--version"], capture_output=True, text=True)
            if result.returncode == 0:
                if current_project:
                    config[task_key] = "True"
                    save_config(current_project, config)
                return True
            return False

        result = subprocess.run([tool_name, "--version"], capture_output=True, text=True)
        if result.returncode == 0:
            if current_project:
                config[task_key] = "True"
                save_config(current_project, config)
            return True
        return False

    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        print(f"Error checking installation of {tool_name}: {str(e)}")
        return False


def ensure_v0_projects_dir():
    projects_dir = os.path.expanduser("~/Documents/V0_Projects")
    if not os.path.exists(projects_dir):
        os.makedirs(projects_dir)
    return projects_dir

def ensure_default_project():
    default_project_dir = os.path.join(PROJECTS_DIR, DEFAULT_PROJECT_NAME)
    version_file = os.path.join(default_project_dir, "version.ini")
    if not os.path.exists(default_project_dir):
        os.makedirs(default_project_dir)
    if not os.path.exists(version_file):
        with open(version_file, "w") as f:
            f.write("[DEFAULT]\nсоздать_папку_проекта=complete\n")
    return default_project_dir

def clone_repository(project_name):
    config = load_config(project_name)
    target_dir = os.path.join(PROJECTS_DIR, project_name)
    if not os.path.exists(target_dir):
        publish_event('progress', {"message": f"Starting to clone repository for {project_name}...", "progress": 0})
        result = run_command(f"git clone {GITHUB_URL} \"{target_dir}\"", "Репозиторий успешно клонирован.", "Не удалось клонировать репозиторий.")
        if json.loads(result)["status"] == "success":
            config["REPO_CLONED_COMPLETED"] = "True"
            save_config(project_name, config)
            publish_event('progress', {"message": f"Repository cloned successfully for {project_name}", "progress": 100})
        else:
            publish_event('progress', {"message": json.loads(result)["message"], "progress": -1})
        return result

def create_project():
    github_url = simpledialog.askstring("Создать проект", "Введите URL репозитория GitHub:")
    if not github_url:
        messagebox.showerror("Ошибка", "URL репозитория не может быть пустым.")
        return json.dumps({"status": "error", "message": "URL репозитория не может быть пустым."})
    
    project_name = github_url.split("/")[-1].replace(".git", "")
    project_dir = os.path.join(PROJECTS_DIR, project_name)
    if os.path.exists(project_dir):
        messagebox.showerror("Ошибка", f"Проект '{project_name}' уже существует.")
        return json.dumps({"status": "error", "message": f"Проект '{project_name}' уже существует."})
    
    os.makedirs(project_dir)
    publish_event('progress', {"message": f"Cloning repository for new project {project_name}...", "progress": 0})
    result = subprocess.run(["git", "clone", github_url, project_dir], check=True, capture_output=True, text=True)
    if result.returncode == 0:
        initialize_login_checklist(project_name)
        load_projects()
        publish_event('progress', {"message": f"New project '{project_name}' created and cloned successfully.", "progress": 100})
        return json.dumps({"status": "success", "message": f"New project '{project_name}' created and cloned successfully."})
    else:
        publish_event('progress', {"message": f"Failed to clone repository: {result.stderr}", "progress": -1})
        return json.dumps({"status": "error", "message": f"Failed to clone repository: {result.stderr}"})

def switch_project(event):
    selected_project = projects_combobox.get()
    if selected_project:
        current_project = selected_project
        refresh_dashboard()
        return json.dumps({"status": "success", "message": f"Switched to project {selected_project}"})
    return json.dumps({"status": "error", "message": "No project selected"})

def create_project_folder():
    projects_dir = os.path.expanduser("~/Documents/V0_Projects")
    config = load_config(DEFAULT_PROJECT_NAME)

    if not os.path.exists(projects_dir):
        publish_event('progress', {"message": "Creating V0_Projects folder...", "progress": 0})
        os.makedirs(projects_dir)
        config["project_folder_created"] = "True"
        save_config(DEFAULT_PROJECT_NAME, config)
        publish_event('progress', {"message": f"Папка {projects_dir} успешно создана.", "progress": 100})
        return {
            "status": "success",
            "message": f"Папка {projects_dir} успешно создана."
        }, 200
    elif "project_folder_created" not in config:
        config["project_folder_created"] = "True"
        save_config(DEFAULT_PROJECT_NAME, config)
        publish_event('progress', {"message": f"Папка {projects_dir} уже существует. Ярлык создан на рабочем столе.", "progress": 100})
        return {
            "status": "info",
            "message": f"Папка {projects_dir} уже существует. Ярлык создан на рабочем столе."
        }, 200
    else:
        return {
            "status": "info",
            "message": f"Папка {projects_dir} уже существует."
        }, 200

def load_config(project_name):
    config_file = os.path.join(PROJECTS_DIR, project_name, "version.ini")
    config = {}
    if os.path.exists(config_file):
        with open(config_file, "r", encoding="utf-8") as f:
            for line in f:
                if "=" in line:
                    key, value = line.strip().split("=", 1)
                    config[key] = value
    return config

def save_config(project_name, config):
    config_file = os.path.join(PROJECTS_DIR, project_name, "version.ini")
    with open(config_file, "w", encoding="utf-8") as f:
        for key, value in config.items():
            f.write(f"{key}={value}\n")

def load_projects():
    projects_dir = os.path.expanduser("~/Documents/V0_Projects")
    if not os.path.exists(projects_dir):
        os.makedirs(projects_dir)
    projects = [d for d in os.listdir(projects_dir) if os.path.isdir(os.path.join(projects_dir, d))]
    if not projects:
        ensure_default_project()
        projects = ["cartest"]
    return projects

def mark_step_completed(step):
    config = load_config(current_project)
    config[step] = "completed"
    save_config(current_project, config)
    publish_event('progress', {"message": f"Step {step} marked as completed.", "progress": 100})

# Download and Install Tools
def is_tool_installed(tool_name):
    """
    Check if a tool is installed by verifying its presence in the system PATH.
    """
    return shutil.which(tool_name) is not None

# Initialize Login Checklist
def initialize_login_checklist(project_name):
    """
    Initialize the login checklist only if it hasn't been set before.
    """
    config = load_config(project_name)
    
    # Check if the checklist has already been initialized
    if "github" in config and "vercel" in config and "supabase" in config:
        return json.dumps({
            "status": "info",
            "message": "Лист проверки входа уже настроен."
        })
    
    # Initialize checklist only if not already set
    login_checklist = {
        "github": "not_started",
        "vercel": "not_started",
        "v0_dev": "not_started",
        "supabase": "not_started",
        "config_start_time": str(int(time.time())),  # Record the start timestamp
        "user_id": str(uuid.uuid4()),  # Create a unique user ID
    }
    
    # Update config only for keys that don't exist yet
    for key, value in login_checklist.items():
        if key not in config:
            config[key] = value
    
    save_config(project_name, config)
    
    # Inform the user and open login pages in browser
    webbrowser.open("https://github.com/login")
    webbrowser.open("https://vercel.com/login")
    webbrowser.open("https://v0.dev/login")
    webbrowser.open("https://supabase.com/dashboard/login")
    
    # Check GitHub login immediately after opening the page
    verify_github_login()
    
    return json.dumps({
        "status": "success",
        "message": "Открываю страницы для входа..."
    })


# Ensure TEMP_DIR is defined and valid
TEMP_DIR = os.path.join(os.getenv("TEMP", os.path.expanduser("~/AppData/Local/Temp")), "setup_temp")
if not os.path.exists(TEMP_DIR):
    os.makedirs(TEMP_DIR, exist_ok=True)

def download_and_install(tool_name, current_project):
    with installation_lock:
        if not current_project or not isinstance(current_project, str):
            publish_event('progress', {"message": f"Invalid project name: {current_project}", "progress": -1, "tool": tool_name})
            return {
                "status": "error",
                "message": f"Invalid project name: {current_project}",
                "refresh": False
            }, 400

        config = load_config(current_project)
        skill_key = ("Установить " + tool_name).lower().replace(" ", "_")
        
        # Notify start
        publish_event('progress', {"message": f"Starting download of {tool_name}...", "progress": 0, "tool": tool_name})

        # Check if the tool is already installed
        if is_tool_installed(tool_name.lower()):
            config[skill_key] = "completed"
            save_config(current_project, config)
            publish_event('progress', {"message": f"{tool_name} уже установлен.", "progress": 100, "tool": tool_name})
            return {
                "status": "success",
                "message": f"{tool_name} уже установлен и отмечен как выполненный.",
                "refresh": True
            }, 200
        
        url = DOWNLOAD_URLS.get(tool_name)
        if not url:
            publish_event('progress', {"message": f"URL для {tool_name} не найден.", "progress": -1, "tool": tool_name})
            return {
                "status": "error",
                "message": f"URL для {tool_name} не найден.",
                "refresh": False
            }, 404
        
        file_name = f"{tool_name.replace(' ', '_')}-Installer.exe"
        file_path = os.path.join(TEMP_DIR, file_name)
        if not isinstance(file_path, str):
            publish_event('progress', {"message": f"Failed to construct file path for {tool_name}", "progress": -1, "tool": tool_name})
            return {
                "status": "error",
                "message": f"Failed to construct file path for {tool_name}",
                "refresh": False
            }, 500

        # Download with progress updates
        try:
            with requests.get(url, stream=True, timeout=30) as response:
                if response.status_code != 200:
                    raise Exception(f"Failed to download {tool_name}: HTTP {response.status_code}")
                
                total_size = int(response.headers.get('content-length', 0))
                block_size = 1024  # 1 KB
                downloaded = 0
                
                publish_event('progress', {"message": f"Downloading {tool_name}...", "progress": 0, "tool": tool_name})
                
                with open(file_path, 'wb') as f:
                    for data in response.iter_content(block_size):
                        if data:
                            downloaded += len(data)
                            f.write(data)
                            progress = int((downloaded / total_size) * 100)
                            if progress in [25, 50, 75, 100]:
                                publish_event('progress', {"message": f"Download progress: {progress}%", "progress": progress, "tool": tool_name})

                publish_event('progress', {"message": f"Download of {tool_name} completed.", "progress": 100, "tool": tool_name})
                print("\nDownload completed.")
        except Exception as e:
            error_msg = f"Не удалось скачать {tool_name}: {str(e)}"
            publish_event('progress', {"message": error_msg, "progress": -1, "tool": tool_name})
            print(error_msg)
            return {
                "status": "error",
                "message": error_msg,
                "refresh": False
            }, 500

        # Install with progress updates
        install_args = {
            "Git": "/VERYSILENT /NORESTART /NOCANCEL",
            "Node.js": "/quiet",
            "Notepad++": "/S",
            "VS Code": "/verysilent /suppressmsgboxes"
        }
        args = install_args.get(tool_name, "")
        
        try:
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"Installer not found at {file_path}")

            publish_event('progress', {"message": f"Installing {tool_name}...", "progress": 0, "tool": tool_name})
            
            process = subprocess.run(
                f'"{file_path}" {args}',
                shell=True,
                capture_output=True,
                text=True,
                timeout=600
            )
            
            if process.returncode != 0:
                raise subprocess.CalledProcessError(process.returncode, command=f'"{file_path}" {args}', output=process.stderr)

            if not is_tool_installed(tool_name.lower()):
                raise Exception(f"Установка {tool_name} завершилась, но инструмент не найден в системе.")

            publish_event('progress', {"message": f"Installation of {tool_name} completed.", "progress": 100, "tool": tool_name})

            config[skill_key] = "completed"
            save_config(current_project, config)

            return {
                "status": "success",
                "message": f"{tool_name} успешно установлен.",
                "refresh": True
            }, 200

        except subprocess.TimeoutExpired as e:
            error_msg = f"Таймаут при установке {tool_name}: процесс не завершился в течение 10 минут."
            publish_event('progress', {"message": error_msg, "progress": -1, "tool": tool_name})
            print(error_msg)
            return {
                "status": "error",
                "message": error_msg,
                "refresh": False
            }, 500

        except subprocess.CalledProcessError as e:
            error_msg = f"Не удалось установить {tool_name}: {e.output or 'Неизвестная ошибка'}"
            publish_event('progress', {"message": error_msg, "progress": -1, "tool": tool_name})
            print(error_msg)
            return {
                "status": "error",
                "message": error_msg,
                "refresh": False
            }, 500

        except Exception as e:
            error_msg = f"Неизвестная ошибка при установке {tool_name}: {str(e)}"
            publish_event('progress', {"message": error_msg, "progress": -1, "tool": tool_name})
            print(error_msg)
            return {
                "status": "error",
                "message": error_msg,
                "refresh": False
            }, 500

def run_command(command, success_message="Успех", error_message="Ошибка"):
    publish_event('progress', {"message": f"Executing command: {command}...", "progress": 0})
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        publish_event('progress', {"message": success_message + "\n" + result.stdout, "progress": 100})
        return json.dumps({
            "status": "success",
            "message": success_message + "\n" + result.stdout
        })
    except subprocess.CalledProcessError as e:
        publish_event('progress', {"message": error_message + "\n" + e.stderr, "progress": -1})
        return json.dumps({
            "status": "error",
            "message": error_message + "\n" + e.stderr
        })

def apply_zip_updates(project_name):
    config = load_config(project_name)
    zip_path = filedialog.askopenfilename(
        title="Выберите ZIP файл",
        filetypes=[("ZIP Files", "*.zip")],
        initialdir=REPO_DIR,
    )
    if not zip_path or not os.path.exists(zip_path):
        publish_event('progress', {"message": "ZIP файл не выбран.", "progress": -1, "tool": "ZIP Update"})
        return {
            "status": "warning",
            "message": "ZIP файл не выбран."
        }, 400  # Return early with error status

    try:
        publish_event('progress', {"message": "Starting ZIP update process...", "progress": 0, "tool": "ZIP Update"})

        # Save and extract ZIP
        temp_dir = os.path.join(TEMP_DIR, "temp_unzip")
        os.makedirs(temp_dir, exist_ok=True)
        zip_filename = os.path.basename(zip_path)
        shutil.copy2(zip_path, os.path.join(TEMP_DIR, zip_filename))

        publish_event('progress', {"message": "Extracting ZIP file...", "progress": 25, "tool": "ZIP Update"})

        # Extract ZIP using PowerShell
        subprocess.run(
            f"powershell -Command \"Expand-Archive -Force '{os.path.join(TEMP_DIR, zip_filename)}' -DestinationPath '{temp_dir}'\"",
            shell=True,
            check=True,
        )

        publish_event('progress', {"message": "Copying files to repository (excluding .gitignore)...", "progress": 50, "tool": "ZIP Update"})

        repo_dir = os.path.join(PROJECTS_DIR, project_name)

        # Copy files, excluding .gitignore
        for item in os.listdir(temp_dir):
            source_path = os.path.join(temp_dir, item)
            dest_path = os.path.join(repo_dir, item)

            if item == ".gitignore":
                publish_event('progress', {"message": f"Skipping .gitignore file.", "progress": 50, "tool": "ZIP Update"})
                continue

            if os.path.isdir(source_path):
                shutil.copytree(source_path, dest_path, dirs_exist_ok=True)
            else:
                shutil.copy2(source_path, dest_path)

        # Clean up temporary directory
        shutil.rmtree(temp_dir)

        publish_event('progress', {"message": "Updating version and committing changes...", "progress": 75, "tool": "ZIP Update"})

        current_version = int(config.get("CURRENT_VERSION", 0))
        next_version = current_version + 1
        config["CURRENT_VERSION"] = str(next_version)
        config["LAST_APPLIED_ZIP"] = zip_filename
        save_config(project_name, config)

        branch_name = f"update-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        subprocess.run(f"git checkout -b {branch_name}", cwd=repo_dir, shell=True, check=True)
        subprocess.run("git add .", cwd=repo_dir, shell=True, check=True)
        commit_msg = f"Обновления от {zip_filename} | Версия {next_version}"
        subprocess.run(f"git commit -m \"{commit_msg}\"", cwd=repo_dir, shell=True, check=True)
        subprocess.run(f"git push origin {branch_name}", cwd=repo_dir, shell=True, check=True)
        subprocess.run("git checkout main", cwd=repo_dir, shell=True, check=True)
        subprocess.run("git pull origin main", cwd=repo_dir, shell=True, check=True)

        publish_event('progress', {"message": "ZIP updates applied successfully.", "progress": 100, "tool": "ZIP Update"})

        return {
            "status": "success",
            "message": "ZIP обновления применены успешно и создан Pull Request (excluding .gitignore)."
        }, 200

    except subprocess.CalledProcessError as e:
        error_msg = f"Не удалось применить ZIP обновления: {e.stderr}"
        publish_event('progress', {"message": error_msg, "progress": -1, "tool": "ZIP Update"})
        return {
            "status": "error",
            "message": error_msg
        }, 500

    except Exception as e:
        error_msg = f"Неизвестная ошибка при обновлении ZIP: {str(e)}"
        publish_event('progress', {"message": error_msg, "progress": -1, "tool": "ZIP Update"})
        return {
            "status": "error",
            "message": error_msg
        }, 500


def generate_installation_achievement(achievement_name, current_project):
    config = load_config(current_project)
    task_key = achievement_name.lower().replace(" ", "_")
    if task_key not in config or config[task_key] != "completed":
        config[task_key] = "completed"
        save_config(current_project, config)
        return json.dumps({
            "status": "success",
            "message": f"🏆 {achievement_name}"
        })
    return json.dumps({
        "status": "info",
        "message": f"Достижение {achievement_name} уже разблокировано."
    })


# musthooks.py

def check_git_status(current_project):
    """
    Check the Git status for the specified project directory.
    """
    project_dir = os.path.join(PROJECTS_DIR, current_project)
    
    # Ensure the project directory exists
    if not os.path.exists(project_dir):
        return "❌ Git: Project directory not found."

    try:
        # Switch to the project directory
        result = subprocess.run(
            ["git", "status", "-uno"],
            cwd=project_dir,  # Set the working directory to the project folder
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        
        # Analyze the output
        if "Your branch is up to date" in result.stdout:
            return "✅"
        elif "Your branch is behind" in result.stdout:
            return "⚠️ Есть обнова"
        else:
            return f"❓ Git: {result.stdout.strip()}"
    except subprocess.CalledProcessError as e:
        # Handle errors (e.g., Git not initialized in the project folder)
        return "❌ Git: Not initialized or error occurred."


def create_desktop_shortcut(target_path, shortcut_name):
    """
    Create a desktop shortcut for the given target path using pywin32.
    """
    desktop = shell.SHGetFolderPath(0, shellcon.CSIDL_DESKTOP, 0, 0)
    shortcut_path = os.path.join(desktop, f"{shortcut_name}.lnk")
    
    shortcut = pythoncom.CoCreateInstance(
        shell.CLSID_ShellLink,
        None,
        pythoncom.CLSCTX_INPROC_SERVER,
        shell.IID_IShellLink
    )
    
    shortcut.SetPath(target_path)
    shortcut.SetWorkingDirectory(os.path.dirname(target_path))
    shortcut.SetIconLocation(sys.executable, 0)
    
    persist_file = shortcut.QueryInterface(pythoncom.IID_IPersistFile)
    persist_file.Save(shortcut_path, 0)
    
    return json.dumps({
        "status": "success",
        "message": f"Shortcut created successfully at: {shortcut_path}"
    })