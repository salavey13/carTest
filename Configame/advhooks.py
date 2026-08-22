# advhooks.py
import os
import subprocess
import requests
from flask import jsonify

# Configuration
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")  # Ensure this is set in your environment variables

# Generate Embeddings for Semantic Search
def generate_embeddings(project_name: str):
    """
    Regenerate embeddings for semantic search using a script.
    Returns a JSON response indicating success or failure.
    """
    project_dir = os.path.join(os.path.expanduser("~/Documents/V0_Projects"), project_name)
    embeddings_script = os.path.join(project_dir, "utils", "embeddingsGenerator.ts")
    
    if not os.path.exists(embeddings_script):
        return jsonify({
            "message": f"Embeddings generator script not found in {project_dir}",
            "success": False
        }), 404  # Return 404 for missing script
    
    try:
        subprocess.run(
            ["npx", "tsx", embeddings_script],
            check=True,
            cwd=project_dir,
        )
        return jsonify({
            "message": "Embeddings successfully regenerated.",
            "success": True
        }), 200  # Return 200 for success
    except subprocess.CalledProcessError as e:
        return jsonify({
            "message": f"Failed to regenerate embeddings: {str(e)}",
            "success": False
        }), 500  # Return 500 for server error

# Create Pull Request in GitHub
def create_pull_request(project_name: str, branch_name: str, title: str, body: str):
    """
    Create a pull request in GitHub for the specified branch.
    Returns a JSON response indicating success or failure.
    """
    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
    }
    payload = {
        "title": title,
        "body": body,
        "head": branch_name,
        "base": "main",  # Assuming 'main' is the default branch
    }
    repo_url = f"https://api.github.com/repos/salavey13/{project_name}/pulls"
    
    try:
        response = requests.post(repo_url, json=payload, headers=headers)
        if response.status_code == 201:
            return jsonify({
                "message": f"Pull request created successfully: {response.json()['html_url']}",
                "success": True
            }), 201  # Return 201 for successful creation
        else:
            return jsonify({
                "message": f"Failed to create pull request: {response.text}",
                "success": False
            }), response.status_code  # Return the actual status code from GitHub
    except Exception as e:
        return jsonify({
            "message": f"An error occurred while creating the pull request: {str(e)}",
            "success": False
        }), 500  # Return 500 for server error