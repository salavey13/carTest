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
from tkinter import messagebox
import winreg
import webbrowser
import json
from tkinter import filedialog

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
V0_DEV_URL = "https://v0.dev/chat/fork-of-rastaman-shop-KvYJosUCML9"
VERCEL_URL = "https://vercel.com"
SUPABASE_URL = "https://supabase.com"
GITHUB_URL = f"https://github.com/salavey13/{DEFAULT_PROJECT_NAME}"
TEMP_DIR = os.path.join(os.getenv("TEMP"), "setup_temp")
# URLs for downloads
DOWNLOAD_URLS = {
    "Git": "https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.2/Git-2.47.1.2-64-bit.exe",
    "Node.js": "https://nodejs.org/dist/v22.13.1/node-v22.13.1-x64.msi",
    "Notepad++": "https://github.com/notepad-plus-plus/notepad-plus-plus/releases/download/v8.7.6/npp.8.7.6.Installer.x64.exe",
    "VS Code": "https://code.visualstudio.com/sha/download?build=stable&os=win32-x64-user",
}



def get_npm_path():
    # Find the full path to node
    node_path = shutil.which("node")
    if not node_path:
        raise FileNotFoundError("Node.js is not installed or not found in PATH.")
    
    # Derive the npm path by replacing 'node' with 'npm'
    npm_path = node_path.replace("node.exe", "npm")
    
    # Verify that the derived npm path exists
    if not os.path.exists(npm_path):
        raise FileNotFoundError(f"npm not found at the expected location: {npm_path}")
    
    return npm_path 
    
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
        
def is_tool_installed(tool_name, current_project):
    config = load_config(current_project)
    
    # Check if the tool installation status is already saved in version.ini
    task_key = f"{tool_name.lower()}_installed"
    if task_key in config and config[task_key] == "True":
        return True
    
    # Proceed with the actual check if not found in version.ini
    try:
        subprocess.run([tool_name, "--version"], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        
        # Save the result to version.ini to avoid future checks
        config[task_key] = "True"
        save_config(current_project, config)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
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
    
def clone_repository(project_name: str):
    config = load_config(project_name)
    targetDir = os.path.join(PROJECTS_DIR, project_name)  # Dynamic repo path
    if not os.path.exists(REPO_DIR):
        run_command(f"git clone {GITHUB_URL} \"{targetDir}\"", "Репозиторий успешно клонирован.", "Не удалось клонировать репозиторий.")
        config["REPO_CLONED_COMPLETED"] = "True"
        save_config(project_name, config)

# Create New Project
def create_project():
    github_url = simpledialog.askstring("Создать проект", "Введите URL репозитория GitHub:")
    if not github_url:
        messagebox.showerror("Ошибка", "URL репозитория не может быть пустым.")
        return
    project_name = github_url.split("/")[-1].replace(".git", "")
    project_dir = os.path.join(PROJECTS_DIR, project_name)
    if os.path.exists(project_dir):
        messagebox.showerror("Ошибка", f"Проект '{project_name}' уже существует.")
        return
    os.makedirs(project_dir)
    subprocess.run(["git", "clone", github_url, project_dir], check=True)
    # Initialize version.ini with login checklist
    initialize_login_checklist(project_name)
    load_projects()
    #projects_combobox["values"] = projects
    #projects_combobox.set(project_name)
    #refresh_dashboard()
    
# Switch Project
def switch_project(event):
    selected_project = projects_combobox.get()
    if selected_project:
        current_project = selected_project
        refresh_dashboard()
        
# Create the V0_Projects folder
def create_project_folder():
    """Create the V0_Projects folder."""
    projects_dir = os.path.expanduser("~/Documents/V0_Projects")
    config = load_config(DEFAULT_PROJECT_NAME)

    if not os.path.exists(projects_dir):
        os.makedirs(projects_dir)
        config["project_folder_created"] = "True"
        save_config(DEFAULT_PROJECT_NAME, config)
        return jsonify({
            "status": "success",
            "message": f"Папка {projects_dir} успешно создана."
        })
    elif "project_folder_created" not in config:
        config["project_folder_created"] = "True"
        save_config(DEFAULT_PROJECT_NAME, config)
        return jsonify({
            "status": "info",
            "message": f"Папка {projects_dir} уже существует. Ярлык создан на рабочем столе."
        })
    else:
        return jsonify({
            "status": "info",
            "message": f"Папка {projects_dir} уже существует."
        })

# Load Configuration for Selected Project
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

# Save Configuration for Selected Project
def save_config(project_name, config):
    config_file = os.path.join(PROJECTS_DIR, project_name, "version.ini")
    with open(config_file, "w", encoding="utf-8") as f:
        for key, value in config.items():
            f.write(f"{key}={value}\n")
            
def load_projects():
    projects_dir = os.path.expanduser("~/Documents/V0_Projects")
    if not os.path.exists(projects_dir):
        os.makedirs(projects_dir)
    projects = [d for d in os.listdir(projects_dir) 
               if os.path.isdir(os.path.join(projects_dir, d))]
    if not projects:
        ensure_default_project()
        projects = ["cartest"]
    return projects

# Mark Step as Completed
def mark_step_completed(step):
    config = load_config(current_project)
    config[step] = "completed"
    save_config(current_project, config)

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


def download_and_install(tool_name, current_project):
    config = load_config(current_project)
    
    # Check if the tool is already installed
    if is_tool_installed(tool_name.lower()):
        return json.dumps({
            "status": "info",
            "message": f"{tool_name} уже установлен.",
            "refresh": False
        }), 200
    
    url = DOWNLOAD_URLS.get(tool_name)
    if not url:
        return json.dumps({
            "status": "error",
            "message": f"URL для {tool_name} не найден.",
            "refresh": False
        }), 404
    
    file_path = os.path.join(TEMP_DIR, f"{tool_name.replace(' ', '_')}-Installer.exe")
    if not os.path.exists(TEMP_DIR):
        os.makedirs(TEMP_DIR)
    
    # Download with progress
    try:
        import requests
        response = requests.get(url, stream=True)
        total_size = int(response.headers.get('content-length', 0))
        block_size = 1024  # 1 KB
        downloaded = 0
        
        with open(file_path, 'wb') as f:
            for data in response.iter_content(block_size):
                downloaded += len(data)
                f.write(data)
                progress = int(50 * downloaded / total_size)
                print(f"\r[{'#' * progress}{'.' * (50 - progress)}] {downloaded / 1024:.2f}/{total_size / 1024:.2f} KB", end="")
        
        print("\nDownload completed.")
    except Exception as e:
        return json.dumps({
            "status": "error",
            "message": f"Не удалось скачать {tool_name}: {str(e)}",
            "refresh": False
        }), 500
    
    # Install
    install_args = {
        "Git": "/VERYSILENT /NORESTART /NOCANCEL",
        "Node.js": "/quiet",
        "Notepad++": "/S",
        "VS Code": "/verysilent /suppressmsgboxes"
    }
    args = install_args.get(tool_name, "")
    if not run_command(f'"{file_path}" {args}', 
                       f"{tool_name} установлен успешно.", f"Не удалось установить {tool_name}."):
        return json.dumps({
            "status": "error",
            "message": f"Не удалось установить {tool_name}.",
            "refresh": False
        }), 500
    
    # Add to installed tools and save config
    config.setdefault("TOOLS_INSTALLED", []).append(tool_name)
    save_config(current_project, config)
    return json.dumps({
        "status": "success",
        "message": f"{tool_name} успешно установлен.",
        "refresh": True
    }), 200


def run_command(command, success_message="Успех", error_message="Ошибка"):
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        return json.dumps({
            "status": "success",
            "message": success_message + "\n" + result.stdout
        })
    except subprocess.CalledProcessError as e:
        return json.dumps({
            "status": "error",
            "message": error_message + "\n" + e.stderr
        })


def apply_zip_updates(project_name: str):
    config = load_config(project_name)
    zip_path = filedialog.askopenfilename(
        title="Выберите ZIP файл",
        filetypes=[("ZIP Files", "*.zip")],
        initialdir=REPO_DIR,
    )
    if not zip_file or zip_file.filename == '':
        return jsonify({"status": "warning", "message": "ZIP файл не выбран."})

    try:
        # Save the uploaded ZIP file temporarily
        temp_dir = os.path.join(os.getenv("TEMP"), "setup_temp")
        os.makedirs(temp_dir, exist_ok=True)
        zip_path = os.path.join(temp_dir, zip_file.filename)
        zip_file.save(zip_path)

        # Extract the ZIP file
        extract_dir = os.path.join(temp_dir, "temp_unzip")
        subprocess.run(
            f"powershell -Command \"Expand-Archive -Force '{zip_path}' -DestinationPath '{extract_dir}'\"",
            shell=True,
            check=True,
        )

        # Copy extracted files to the repository directory
        repo_dir = os.path.join(PROJECTS_DIR, project_name)
        subprocess.run(f"xcopy /s /y \"{extract_dir}\\*\" \"{repo_dir}\"", shell=True, check=True)
        subprocess.run(f"rmdir /s /q \"{extract_dir}\"", shell=True, check=True)

        # Update version file
        current_version = int(config.get("CURRENT_VERSION", 0))
        next_version = current_version + 1
        config["CURRENT_VERSION"] = str(next_version)
        config["LAST_APPLIED_ZIP"] = zip_file.filename
        save_config(project_name, config)

        # Create pull request
        branch_name = f"update-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        subprocess.run(f"git checkout -b {branch_name}", shell=True, check=True)
        subprocess.run("git add .", shell=True, check=True)
        commit_msg = f"Обновления от {zip_file.filename} | Версия {next_version}"
        subprocess.run(f"git commit -m \"{commit_msg}\"", shell=True, check=True)
        subprocess.run(f"git push origin {branch_name}", shell=True, check=True)
        subprocess.run("git checkout main", shell=True, check=True)
        subprocess.run("git pull origin main", shell=True, check=True)

        return jsonify({
            "status": "success",
            "message": "ZIP обновления применены успешно и создан Pull Request."
        })

    except subprocess.CalledProcessError as e:
        return jsonify({
            "status": "error",
            "message": f"Не удалось применить ZIP обновления: {e.stderr}"
        }), 500


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