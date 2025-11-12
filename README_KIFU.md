# Kifu Ingestion Pipeline

This document describes how to use the Kifu ingestion pipeline for batch annotation of Shogi games from local files.

## Overview

The Kifu ingestion system provides:
- **Local folder processing**: Batch annotate multiple KIF/CSA/USI files
- **Multiple format support**: KIF, KIFU, CSA, and USI formats
- **Provider interface**: Extensible architecture for future data sources
- **CLI and API access**: Both command-line and web interface
- **Shogi Wars compatibility**: Process manually exported files

## Quick Start

### 1. Setup Folders

Create the necessary directory structure:

```bash
mkdir -p data/kifu data/out
```

Or use the API endpoint to set up automatically:

```bash
curl -X POST http://localhost:8787/ingest/setup/folders
```

### 2. Add Kifu Files

Place your Kifu files in the input directory:

```bash
# Default location
cp your_games/*.kif data/kifu/
cp your_games/*.csa data/kifu/
cp your_games/*.usi data/kifu/

# Or use custom directory
export KIFU_DIR=/path/to/your/kifu/files
```

### 3. Run Batch Annotation

Using the CLI script:

```bash
./scripts/annotate_folder.sh
```

Or using the API directly:

```bash
curl -X POST http://localhost:8787/ingest/annotate/folder \
  -H "Content-Type: application/json" \
  -d '{"recursive": true, "byoyomi_ms": 250}'
```

## Usage Methods

### CLI Script (Recommended)

The `annotate_folder.sh` script provides a convenient command-line interface:

```bash
# Basic usage - process all files in KIFU_DIR
./scripts/annotate_folder.sh

# Custom directory with faster engine time
./scripts/annotate_folder.sh --dir /path/to/games --time 100

# Verbose output
./scripts/annotate_folder.sh --verbose

# Local mode (no API server required)
./scripts/annotate_folder.sh --local

# Help
./scripts/annotate_folder.sh --help
```

#### CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `-d, --dir` | Input directory | `$KIFU_DIR` or `data/kifu` |
| `-o, --out` | Output directory | `$KIFU_OUT` or `data/out` |
| `-t, --time` | Engine time per move (ms) | 250 |
| `-r, --recursive` | Process subdirectories | true |
| `-s, --skip-validation` | Skip USI validation | false |
| `-v, --verbose` | Verbose output | false |
| `--server` | API server URL | `http://localhost:8787` |
| `--local` | Local Python mode | false |

### Web Interface

Access the annotation page at `http://localhost:3000/annotate` and click the "フォルダから一括注釈 (dev)" button.

### API Endpoints

#### Folder Annotation

```bash
POST /ingest/annotate/folder
Content-Type: application/json

{
  "dir": "/optional/custom/path",
  "recursive": true,
  "byoyomi_ms": 250,
  "skip_validation": false
}
```

Response:
```json
{
  "success": true,
  "scanned": 15,
  "annotated": 14,
  "errors": 1,
  "skipped": 0,
  "total_time_ms": 45000,
  "output_dir": "data/out"
}
```

#### Single File Annotation

```bash
POST /ingest/annotate/file
Content-Type: application/json

{
  "path": "data/kifu/game1.kif",
  "byoyomi_ms": 250
}
```

#### Folder Statistics

```bash
GET /ingest/folder/stats?dir=/optional/path
```

Response:
```json
{
  "exists": true,
  "folder_path": "data/kifu",
  "total_files": 15,
  "by_extension": {
    ".kif": 10,
    ".csa": 3,
    ".usi": 2
  },
  "total_size_mb": 2.4,
  "sample_files": ["data/kifu/game1.kif", "..."]
}
```

## Supported File Formats

### KIF (Japanese Notation)

- Extensions: `.kif`, `.kifu`
- Encoding: UTF-8
- Contains: Japanese move notation, player names, game metadata
- Parsing: Simplified conversion to USI (basic moves only)

Example:
```
先手：プレイヤー1
後手：プレイヤー2
手数----指手---------消費時間--
   1 ７六歩(77)   ( 0:01/00:00:01)
   2 ３四歩(33)   ( 0:01/00:00:02)
```

### CSA (Computer Shogi Association)

- Extension: `.csa`
- Encoding: UTF-8
- Contains: Structured move data, time information, metadata
- Parsing: Direct conversion to USI format

Example:
```
V2.2
$TITLE:Sample Game
$SENTE:Player1
$GOTE:Player2
+7776FU
-3334FU
+2726FU
```

### USI (Universal Shogi Interface)

- Extension: `.usi`
- Encoding: UTF-8
- Contains: Move sequences in USI format
- Parsing: Pass-through (already in target format)

Example:
```
startpos moves 7g7f 3c3d 2g2f 8c8d
```

## File Organization

### Input Structure

```
data/kifu/
├── tournament1/
│   ├── game1.kif
│   ├── game2.csa
│   └── game3.usi
├── training/
│   └── practice.kif
└── wars/              # For Shogi Wars exports
    ├── exported1.kif
    └── exported2.csa
```

### Output Structure

The output directory mirrors the input structure with JSON files:

```
data/out/
├── tournament1/
│   ├── game1.json
│   ├── game2.json
│   └── game3.json
├── training/
│   └── practice.json
└── wars/
    ├── exported1.json
    └── exported2.json
```

### Output JSON Format

Each annotated file contains:

```json
{
  "metadata": {
    "title": "Sample Game",
    "sente": "Player1",
    "gote": "Player2",
    "source_format": "kif",
    "source_path": "data/kifu/game1.kif"
  },
  "source_file": "data/kifu/game1.kif",
  "processing_time": "2024-11-11T10:30:00Z",
  "annotation": {
    "summary": "Analysis summary",
    "notes": [
      {
        "ply": 1,
        "move": "7g7f",
        "reasoning": {
          "summary": "Natural opening move",
          "confidence": 0.8,
          "tags": ["opening", "development"]
        },
        "score_after_cp": 15,
        "delta_cp": 5
      }
    ]
  }
}
```

## Environment Variables

Configure the system using environment variables:

```bash
# Directory configuration
export KIFU_DIR="data/kifu"           # Input directory
export KIFU_OUT="data/out"            # Output directory

# Engine configuration
export ENGINE_PER_MOVE_MS="250"       # Default engine time per move
export USE_DUMMY_ENGINE="1"           # Use dummy engine for testing

# API configuration
export API_SERVER_URL="http://localhost:8787"
export CORS_ORIGINS="http://localhost:3000"
```

## Shogi Wars Integration

### Important Notice

**This system does NOT perform web scraping or automated access to Shogi Wars.**

For legal and ethical reasons, automated downloading of games is not supported. Instead, users must manually export games and place them in the designated folder.

### Manual Export Process

1. **Log into Shogi Wars** using your web browser
2. **Navigate to your game history**
3. **Export individual games** using the site's export features (usually KIF or CSA format)
4. **Save exported files** to the `data/kifu/wars/` folder
5. **Run batch annotation** using the same tools as local files

### Setting Up Shogi Wars Folder

```bash
# Create the Shogi Wars export folder
mkdir -p data/kifu/wars

# Copy your manually exported files
cp ~/Downloads/shogi_wars_game_*.kif data/kifu/wars/

# Process the exported files
./scripts/annotate_folder.sh --dir data/kifu/wars
```

### File Naming Conventions

For better organization, consider naming exported files with:
- Player names: `player1_vs_player2_2024-11-11.kif`
- Game ID: `shogi_wars_game_12345.csa`
- Date: `2024-11-11_tournament_game.kifu`

### Provider Interface

The Shogi Wars provider is implemented as a stub for future expansion:

```python
from backend.ingest.providers.shogi_wars import ShogiWarsProvider

# Current usage (exported files only)
provider = ShogiWarsProvider("data/kifu/wars")
games = provider.search({"player": "username", "limit": 10})
```

Future API integration would require:
- Official API endpoints (if available)
- User authentication system
- Rate limiting compliance
- Terms of service adherence

## Error Handling

### Common Issues

1. **No files found**
   ```bash
   # Check directory exists and contains supported files
   ls -la data/kifu/
   find data/kifu -name "*.kif" -o -name "*.csa" -o -name "*.usi"
   ```

2. **Permission errors**
   ```bash
   # Ensure directories are writable
   chmod -R 755 data/
   ```

3. **API connection failed**
   ```bash
   # Check server is running
   curl http://localhost:8787/health
   
   # Use local mode as fallback
   ./scripts/annotate_folder.sh --local
   ```

4. **Invalid USI moves**
   ```bash
   # Skip validation for problematic files
   ./scripts/annotate_folder.sh --skip-validation
   ```

### Error Output

Failed files are reported with details:

```json
{
  "success": false,
  "errors": 2,
  "error_details": [
    {
      "file": "data/kifu/broken.kif",
      "reason": "Invalid USI moves: Move 5: Invalid format '7g7'"
    },
    {
      "file": "data/kifu/empty.csa", 
      "reason": "No valid moves found in file"
    }
  ]
}
```

## Performance Considerations

### Engine Time Settings

- **Fast processing**: 50-100ms per move
- **Standard quality**: 250ms per move (default)
- **High quality**: 500-1000ms per move

### Batch Size

For large collections:
```bash
# Process specific subfolders
./scripts/annotate_folder.sh --dir data/kifu/tournament1

# Use faster engine settings
./scripts/annotate_folder.sh --time 100

# Monitor progress with verbose output
./scripts/annotate_folder.sh --verbose
```

### Resource Usage

- CPU: Engine analysis is CPU-intensive
- Memory: ~100MB per concurrent annotation
- Disk: JSON output is ~2-5x the input file size

## Development

### Adding New Formats

To support additional file formats:

1. **Extend the parser** in `backend/ingest/kifu_loader.py`:
   ```python
   @classmethod
   def _parse_new_format(cls, file_path: str) -> KifuData:
       # Implementation
   ```

2. **Update format detection**:
   ```python
   def detect_format(cls, file_path: str) -> str:
       # Add new extension/pattern
   ```

3. **Add tests** in `tests/ingest/test_kifu_loader.py`

### Adding New Providers

To support new data sources:

1. **Create provider class** in `backend/ingest/providers/`:
   ```python
   class NewProvider(KifuProvider):
       def search(self, query): ...
       def fetch(self, game_id): ...
   ```

2. **Register in provider registry**:
   ```python
   def get_provider_registry():
       return {
           "new_source": NewProvider,
           # ...
       }
   ```

## Troubleshooting

### Check System Status

```bash
# Verify folder structure
./scripts/annotate_folder.sh --help

# Check API health
curl http://localhost:8787/ingest/providers

# Test with sample file
echo "startpos moves 7g7f 3c3d" > data/kifu/test.usi
./scripts/annotate_folder.sh --dir data/kifu --verbose
```

### Logs and Debugging

- **API logs**: Check FastAPI server output
- **CLI verbose mode**: Use `--verbose` flag
- **Browser console**: Check network requests in web interface
- **Output files**: Verify JSON structure in `data/out/`

### Getting Help

1. Check this documentation
2. Verify environment configuration
3. Test with minimal examples
4. Check server logs for API errors
5. Use local mode to isolate issues

---

## Example Workflow

Complete example from setup to annotation:

```bash
# 1. Setup environment
mkdir -p data/kifu data/out
export KIFU_DIR="data/kifu"
export KIFU_OUT="data/out"

# 2. Add sample files
echo "startpos moves 7g7f 3c3d 2g2f 8c8d" > data/kifu/sample.usi
curl -o data/kifu/sample.kif "https://example.com/sample.kif"  # hypothetical

# 3. Check what's available
./scripts/annotate_folder.sh --help
ls -la data/kifu/

# 4. Run annotation
./scripts/annotate_folder.sh --verbose

# 5. Check results
ls -la data/out/
cat data/out/sample.json | jq '.annotation.summary'

# 6. Use API for more control
curl -X POST http://localhost:8787/ingest/folder/stats | jq
curl -X POST http://localhost:8787/ingest/annotate/folder \
  -H "Content-Type: application/json" \
  -d '{"byoyomi_ms": 500}' | jq
```

This completes the Kifu ingestion pipeline documentation.