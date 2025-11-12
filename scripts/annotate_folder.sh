#!/bin/bash

# annotate_folder.sh
# CLI script for batch Kifu annotation using the Shogi AI Learning API
# 
# Usage:
#   ./scripts/annotate_folder.sh [OPTIONS]
#
# Options:
#   -d, --dir DIR       Kifu directory to process (default: $KIFU_DIR or data/kifu)
#   -o, --out DIR       Output directory (default: $KIFU_OUT or data/out)
#   -t, --time MS       Engine time per move in milliseconds (default: 250)
#   -r, --recursive     Process subdirectories recursively (default: true)
#   -s, --skip-validation  Skip USI move validation
#   -h, --help          Show this help message
#   -v, --verbose       Verbose output
#   --server URL        API server URL (default: http://localhost:8787)
#   --local             Use local Python mode instead of API calls

set -euo pipefail

# Default configuration
KIFU_DIR="${KIFU_DIR:-data/kifu}"
KIFU_OUT="${KIFU_OUT:-data/out}"
ENGINE_TIME="${ENGINE_PER_MOVE_MS:-250}"
SERVER_URL="${API_SERVER_URL:-http://localhost:8787}"
RECURSIVE=true
SKIP_VALIDATION=false
VERBOSE=false
USE_LOCAL=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    if [ "$VERBOSE" = true ]; then
        echo -e "${BLUE}[INFO]${NC} $1"
    fi
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Help function
show_help() {
    cat << EOF
Shogi AI Learning - Batch Kifu Annotation Tool

Usage: $0 [OPTIONS]

OPTIONS:
  -d, --dir DIR           Kifu directory to process (default: \$KIFU_DIR or data/kifu)
  -o, --out DIR          Output directory (default: \$KIFU_OUT or data/out)
  -t, --time MS          Engine time per move in ms (default: 250)
  -r, --recursive        Process subdirectories recursively (default: true)
  -s, --skip-validation  Skip USI move validation
  -h, --help             Show this help message
  -v, --verbose          Verbose output
      --server URL       API server URL (default: http://localhost:8787)
      --local            Use local Python mode instead of API calls

EXAMPLES:
  # Basic usage - annotate all files in data/kifu/
  $0

  # Specify custom directory and faster engine time
  $0 --dir /path/to/kifu --time 100

  # Use local mode (no server required)
  $0 --local --verbose

  # Process only specific directory without recursion
  $0 --dir data/kifu/tournament --recursive false

ENVIRONMENT VARIABLES:
  KIFU_DIR            Default input directory
  KIFU_OUT            Default output directory  
  ENGINE_PER_MOVE_MS  Default engine time
  API_SERVER_URL      Default API server URL

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--dir)
            KIFU_DIR="$2"
            shift 2
            ;;
        -o|--out)
            KIFU_OUT="$2"
            shift 2
            ;;
        -t|--time)
            ENGINE_TIME="$2"
            shift 2
            ;;
        -r|--recursive)
            if [ "$2" = "false" ] || [ "$2" = "0" ]; then
                RECURSIVE=false
            else
                RECURSIVE=true
            fi
            shift 2
            ;;
        -s|--skip-validation)
            SKIP_VALIDATION=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --server)
            SERVER_URL="$2"
            shift 2
            ;;
        --local)
            USE_LOCAL=true
            shift
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Validate directories
if [ ! -d "$KIFU_DIR" ]; then
    log_error "Kifu directory does not exist: $KIFU_DIR"
    log_info "Create the directory or use --dir to specify a different path"
    exit 1
fi

# Create output directory if needed
mkdir -p "$KIFU_OUT"

# Display configuration
log_info "Configuration:"
log_info "  Input Directory: $KIFU_DIR"
log_info "  Output Directory: $KIFU_OUT" 
log_info "  Engine Time: ${ENGINE_TIME}ms per move"
log_info "  Recursive: $RECURSIVE"
log_info "  Skip Validation: $SKIP_VALIDATION"
log_info "  Mode: $([ "$USE_LOCAL" = true ] && echo "Local" || echo "API ($SERVER_URL)")"

# Function to call API
call_api() {
    local endpoint="$1"
    local data="$2"
    local method="${3:-POST}"
    
    if ! command -v curl &> /dev/null; then
        log_error "curl is required for API mode but not installed"
        exit 1
    fi
    
    local response
    if [ "$method" = "POST" ]; then
        response=$(curl -s -X POST "$SERVER_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data" 2>/dev/null)
    else
        response=$(curl -s "$SERVER_URL$endpoint" 2>/dev/null)
    fi
    
    echo "$response"
}

# Function to run local Python annotation
run_local_annotation() {
    log_info "Using local Python mode"
    
    # Check if Python environment is available
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
    local project_root="$(dirname "$script_dir")"
    
    if [ ! -f "$project_root/backend/services/annotate_batch.py" ]; then
        log_error "Local mode requires Python backend at: $project_root/backend/"
        exit 1
    fi
    
    # Create temporary Python script
    local temp_script=$(mktemp)
    cat > "$temp_script" << 'EOF'
import sys
import os
import json
from pathlib import Path

# Add project root to path
project_root = sys.argv[1]
sys.path.insert(0, project_root)

try:
    from backend.services.annotate_batch import BatchAnnotationService
    
    # Get parameters
    kifu_dir = sys.argv[2]
    kifu_out = sys.argv[3] 
    engine_time = int(sys.argv[4])
    recursive = sys.argv[5].lower() == 'true'
    skip_validation = sys.argv[6].lower() == 'true'
    
    # Set environment variables
    os.environ['KIFU_DIR'] = kifu_dir
    os.environ['KIFU_OUT'] = kifu_out
    os.environ['ENGINE_PER_MOVE_MS'] = str(engine_time)
    
    # Create service and process
    service = BatchAnnotationService()
    summary = service.annotate_folder(
        folder_path=kifu_dir,
        recursive=recursive,
        byoyomi_ms=engine_time,
        skip_validation=skip_validation
    )
    
    # Output results
    result = {
        'success': summary.errors == 0,
        'scanned': summary.scanned,
        'annotated': summary.annotated,
        'errors': summary.errors,
        'skipped': summary.skipped,
        'total_time_ms': summary.total_time_ms,
        'error_details': summary.error_details
    }
    
    print(json.dumps(result, indent=2))
    
except ImportError as e:
    print(json.dumps({'error': f'Import error: {e}'}), file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(json.dumps({'error': str(e)}), file=sys.stderr)
    sys.exit(1)
EOF
    
    # Run Python script
    local result
    if result=$(python3 "$temp_script" "$project_root" "$KIFU_DIR" "$KIFU_OUT" "$ENGINE_TIME" "$RECURSIVE" "$SKIP_VALIDATION" 2>/dev/null); then
        echo "$result"
    else
        log_error "Local Python execution failed"
        rm -f "$temp_script"
        exit 1
    fi
    
    rm -f "$temp_script"
}

# Function to check server health
check_server() {
    log_info "Checking server health at $SERVER_URL"
    
    local health_response
    if health_response=$(call_api "/health" "" "GET"); then
        if echo "$health_response" | grep -q '"status".*"ok"'; then
            log_success "Server is healthy"
            return 0
        else
            log_warning "Server health check failed: $health_response"
            return 1
        fi
    else
        log_warning "Cannot connect to server at $SERVER_URL"
        return 1
    fi
}

# Main processing function
process_files() {
    if [ "$USE_LOCAL" = true ]; then
        local result
        result=$(run_local_annotation)
    else
        # Check server first
        if ! check_server; then
            log_error "Server is not available. Use --local mode or start the API server."
            exit 1
        fi
        
        # Prepare API request
        local request_data
        request_data=$(cat << EOF
{
    "dir": "$KIFU_DIR",
    "recursive": $RECURSIVE,
    "byoyomi_ms": $ENGINE_TIME,
    "skip_validation": $SKIP_VALIDATION
}
EOF
)
        
        log_info "Calling API endpoint: /ingest/annotate/folder"
        local result
        result=$(call_api "/ingest/annotate/folder" "$request_data")
    fi
    
    # Parse and display results
    if echo "$result" | grep -q '"success"'; then
        local success=$(echo "$result" | grep -o '"success":[^,]*' | cut -d: -f2 | tr -d ' ')
        local scanned=$(echo "$result" | grep -o '"scanned":[0-9]*' | cut -d: -f2)
        local annotated=$(echo "$result" | grep -o '"annotated":[0-9]*' | cut -d: -f2)
        local errors=$(echo "$result" | grep -o '"errors":[0-9]*' | cut -d: -f2)
        local time_ms=$(echo "$result" | grep -o '"total_time_ms":[0-9]*' | cut -d: -f2)
        
        log_success "Batch annotation completed!"
        echo "  Files scanned: $scanned"
        echo "  Files annotated: $annotated"
        echo "  Errors: $errors"
        echo "  Total time: ${time_ms}ms"
        echo "  Output directory: $KIFU_OUT"
        
        if [ "$errors" -gt 0 ]; then
            log_warning "Some files had errors. Check the API logs for details."
            if [ "$VERBOSE" = true ]; then
                echo "Error details:"
                echo "$result" | grep -o '"error_details":\[[^]]*\]' | sed 's/^"error_details"://' || true
            fi
        fi
        
        if [ "$success" = "true" ]; then
            exit 0
        else
            exit 1
        fi
    else
        log_error "Annotation failed: $result"
        exit 1
    fi
}

# Main execution
main() {
    echo "Shogi AI Learning - Batch Kifu Annotation"
    echo "=========================================="
    
    # Count files first
    local file_count
    if [ "$RECURSIVE" = true ]; then
        file_count=$(find "$KIFU_DIR" -type f \( -name "*.kif" -o -name "*.kifu" -o -name "*.csa" -o -name "*.usi" \) | wc -l)
    else
        file_count=$(find "$KIFU_DIR" -maxdepth 1 -type f \( -name "*.kif" -o -name "*.kifu" -o -name "*.csa" -o -name "*.usi" \) | wc -l)
    fi
    
    if [ "$file_count" -eq 0 ]; then
        log_warning "No Kifu files found in $KIFU_DIR"
        log_info "Supported extensions: .kif, .kifu, .csa, .usi"
        exit 1
    fi
    
    log_info "Found $file_count Kifu files to process"
    
    # Start processing
    process_files
}

# Run main function
main "$@"