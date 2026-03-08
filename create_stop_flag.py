"""
Emergency Stop Flag Creator
Quick utility to create stop flag for graceful training shutdown
"""

from pathlib import Path

def create_stop_flag():
    stop_flag = Path(r"d:\Study\Detect_VNese_Props\stop.flag")
    
    try:
        stop_flag.touch()
        print("✓ Stop flag created successfully!")
        print(f"  Location: {stop_flag}")
        print("\nTraining will stop safely at the next checkpoint.")
        print("The flag file will be automatically deleted.")
    except Exception as e:
        print(f"✗ Error creating stop flag: {e}")

if __name__ == "__main__":
    print("\n" + "="*60)
    print("  EMERGENCY STOP FLAG CREATOR")
    print("="*60 + "\n")
    
    response = input("Create stop flag to safely stop training? (y/n): ").lower()
    
    if response == 'y':
        create_stop_flag()
    else:
        print("Operation cancelled.")
    
    print("\n" + "="*60 + "\n")
