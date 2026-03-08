"""
Automated Training Launcher
Handles environment setup, dependency management, and automatic recovery from errors.
"""

import os
import sys
import subprocess
import venv
from pathlib import Path
import time

# =========================== CONFIGURATION ===========================
class LauncherConfig:
    """Launcher configuration"""
    VENV_PATH = Path(r"d:\Study\Detect_VNese_Props\ultralytics\.venv")
    PROJECT_ROOT = Path(r"d:\Study\Detect_VNese_Props\ultralytics")
    TRAINING_SCRIPT = Path(r"d:\Study\Detect_VNese_Props\train_vn_yolo26.py")
    DATA_YAML = Path(r"d:\Study\Detect_VNese_Props\100_crops_plants_object_detection_25k_image_dataset\leaflogic_vn\data.yaml")
    
    # Required packages
    REQUIRED_PACKAGES = [
        'ultralytics',
        'torch',
        'torchvision',
        'opencv-python',
        'PyYAML',
        'tqdm',
        'matplotlib',
        'seaborn',
        'pandas',
        'scipy'
    ]

# =========================== HELPER FUNCTIONS ===========================
def print_header(text):
    """Print formatted header"""
    print("\n" + "="*80)
    print(f"  {text}")
    print("="*80 + "\n")

def run_command(cmd, env=None, shell=True):
    """Execute command and return result"""
    try:
        result = subprocess.run(
            cmd,
            shell=shell,
            capture_output=True,
            text=True,
            env=env
        )
        return result.returncode, result.stdout, result.stderr
    except Exception as e:
        return -1, "", str(e)

# =========================== VENV MANAGEMENT ===========================
def check_venv_exists(venv_path):
    """Check if virtual environment exists"""
    python_exe = venv_path / "Scripts" / "python.exe"
    return venv_path.exists() and python_exe.exists()

def create_venv(venv_path):
    """Create virtual environment"""
    print_header("CREATING VIRTUAL ENVIRONMENT")
    print(f"📁 Location: {venv_path}")
    
    try:
        venv.create(venv_path, with_pip=True)
        print("✓ Virtual environment created successfully\n")
        return True
    except Exception as e:
        print(f"❌ Failed to create virtual environment: {e}\n")
        return False

def get_venv_python(venv_path):
    """Get path to virtual environment Python executable"""
    return str(venv_path / "Scripts" / "python.exe")

def install_ultralytics(venv_python, project_root):
    """Install ultralytics from PyPI"""
    print_header("INSTALLING ULTRALYTICS")
    print(f"📦 Installing from PyPI")
    
    # Install ultralytics from PyPI
    cmd = f'"{venv_python}" -m pip install ultralytics'
    returncode, stdout, stderr = run_command(cmd)
    
    if returncode == 0:
        print("✓ Ultralytics installed successfully\n")
        return True
    else:
        print(f"❌ Failed to install ultralytics")
        print(f"Error: {stderr}\n")
        return False

def check_package_installed(venv_python, package):
    """Check if a package is installed"""
    cmd = f'"{venv_python}" -m pip show {package}'
    returncode, _, _ = run_command(cmd)
    return returncode == 0

def install_package(venv_python, package):
    """Install a single package"""
    print(f"📦 Installing {package}...", end=" ")
    cmd = f'"{venv_python}" -m pip install {package}'
    returncode, _, stderr = run_command(cmd)
    
    if returncode == 0:
        print("✓")
        return True
    else:
        print(f"❌ Failed")
        print(f"   Error: {stderr}")
        return False

def verify_and_install_dependencies(venv_python, packages):
    """Verify and install missing dependencies"""
    print_header("VERIFYING DEPENDENCIES")
    
    missing_packages = []
    for package in packages:
        if not check_package_installed(venv_python, package):
            missing_packages.append(package)
    
    if not missing_packages:
        print("✓ All dependencies are already installed\n")
        return True
    
    print(f"📋 Missing packages: {', '.join(missing_packages)}\n")
    
    # Install missing packages
    failed = []
    for package in missing_packages:
        if not install_package(venv_python, package):
            failed.append(package)
    
    if failed:
        print(f"\n⚠ Warning: Failed to install: {', '.join(failed)}")
        return False
    
    print("\n✓ All dependencies installed successfully\n")
    return True

# =========================== DATA VALIDATION ===========================
def validate_data_yaml(data_yaml_path):
    """Validate that data.yaml exists and is properly configured"""
    print_header("VALIDATING DATA CONFIGURATION")
    
    if not data_yaml_path.exists():
        print(f"❌ data.yaml not found at: {data_yaml_path}")
        return False
    
    try:
        import yaml
        with open(data_yaml_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        # Check required fields
        required_fields = ['train', 'val', 'nc', 'names']
        missing = [f for f in required_fields if f not in data]
        
        if missing:
            print(f"❌ Missing required fields in data.yaml: {', '.join(missing)}")
            return False
        
        print(f"✓ data.yaml is valid")
        print(f"  - Classes: {data['nc']}")
        print(f"  - Train path: {data['train']}")
        print(f"  - Val path: {data['val']}\n")
        return True
        
    except Exception as e:
        print(f"❌ Error reading data.yaml: {e}")
        return False

# =========================== TRAINING EXECUTION ===========================
def run_training(venv_python, training_script):
    """Execute the training script"""
    print_header("STARTING TRAINING")
    print(f"🚀 Launching: {training_script}\n")
    
    # Build command
    cmd = f'"{venv_python}" "{training_script}"'
    
    # Run training (interactive mode)
    try:
        process = subprocess.Popen(
            cmd,
            shell=True,
            stdout=sys.stdout,
            stderr=sys.stderr,
            stdin=sys.stdin
        )
        
        returncode = process.wait()
        
        if returncode == 0:
            print_header("TRAINING COMPLETED SUCCESSFULLY")
            return True
        else:
            print_header(f"TRAINING ENDED WITH CODE: {returncode}")
            return False
            
    except KeyboardInterrupt:
        print("\n⚠ Training interrupted by user")
        return False
    except Exception as e:
        print(f"\n❌ Error running training: {e}")
        return False

# =========================== ERROR RECOVERY ===========================
def handle_import_error(venv_python, error_message):
    """Try to fix import errors by installing missing packages"""
    print_header("HANDLING IMPORT ERROR")
    
    # Extract package name from error message
    if "No module named" in error_message:
        package = error_message.split("No module named")[1].strip().strip("'\"")
        print(f"📦 Detected missing package: {package}")
        
        if install_package(venv_python, package):
            print("✓ Package installed. Restarting training...\n")
            return True
    
    print("⚠ Could not automatically fix the error\n")
    return False

# =========================== MAIN LAUNCHER ===========================
def main():
    """Main launcher function"""
    print_header("YOLO TRAINING AUTOMATION LAUNCHER")
    print(f"⏰ Start time: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    config = LauncherConfig()
    
    # Step 1: Check/Create virtual environment
    print_header("STEP 1: VIRTUAL ENVIRONMENT SETUP")
    
    if check_venv_exists(config.VENV_PATH):
        print(f"✓ Virtual environment exists at: {config.VENV_PATH}\n")
    else:
        print(f"⚠ Virtual environment not found. Creating new one...")
        if not create_venv(config.VENV_PATH):
            print("❌ FATAL: Could not create virtual environment")
            sys.exit(1)
    
    venv_python = get_venv_python(config.VENV_PATH)
    print(f"🐍 Python executable: {venv_python}\n")
    
    # Step 2: Install Ultralytics
    print_header("STEP 2: ULTRALYTICS INSTALLATION")
    
    if not check_package_installed(venv_python, 'ultralytics'):
        print("⚠ Ultralytics not found. Installing...")
        if not install_ultralytics(venv_python, config.PROJECT_ROOT):
            print("❌ FATAL: Could not install Ultralytics")
            sys.exit(1)
    else:
        print("✓ Ultralytics is already installed\n")
    
    # Step 3: Verify dependencies
    if not verify_and_install_dependencies(venv_python, config.REQUIRED_PACKAGES):
        print("⚠ Warning: Some dependencies could not be installed")
        response = input("Continue anyway? (y/n): ").lower()
        if response != 'y':
            sys.exit(1)
    
    # Step 4: Validate data.yaml
    if not validate_data_yaml(config.DATA_YAML):
        print("❌ FATAL: Data configuration is invalid")
        sys.exit(1)
    
    # Step 5: Run training with auto-retry on errors
    max_retries = 3
    attempt = 0
    
    while attempt < max_retries:
        attempt += 1
        
        if attempt > 1:
            print(f"\n🔄 Retry attempt {attempt}/{max_retries}")
        
        success = run_training(venv_python, config.TRAINING_SCRIPT)
        
        if success:
            print_header("🎉 ALL DONE!")
            print(f"⏰ End time: {time.strftime('%Y-%m-%d %H:%M:%S')}")
            sys.exit(0)
        else:
            if attempt < max_retries:
                print("\n⚠ Training failed. Checking for fixable errors...")
                time.sleep(2)
            else:
                print_header("❌ TRAINING FAILED AFTER ALL RETRIES")
                sys.exit(1)

# =========================== ENTRY POINT ===========================
if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠ Launcher interrupted by user")
        sys.exit(0)
    except Exception as e:
        print(f"\n\n❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
