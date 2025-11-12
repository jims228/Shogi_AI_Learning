# Annotation Output Directory

This directory contains JSON output from batch Kifu annotation.

## Structure

The output directory mirrors the input structure:

```
data/out/
├── tournaments/
│   ├── game1.json
│   └── game2.json
├── training/
│   └── practice.json
└── wars/
    └── exported_games.json
```

## JSON Format

Each file contains:
- Original game metadata
- Processing information
- Detailed move-by-move annotations
- AI reasoning for each move

Example:
```json
{
  "metadata": {
    "title": "Sample Game",
    "sente": "Player1",
    "gote": "Player2",
    "source_format": "kif"
  },
  "source_file": "data/kifu/game.kif",
  "processing_time": "2024-11-11T10:30:00Z",
  "annotation": {
    "summary": "Game analysis summary",
    "notes": [
      {
        "ply": 1,
        "move": "7g7f",
        "reasoning": {
          "summary": "Natural opening development",
          "confidence": 0.85,
          "tags": ["opening", "development"]
        },
        "score_after_cp": 15,
        "delta_cp": 5
      }
    ]
  }
}
```

## Usage

View results:
```bash
# List all annotations
find data/out -name "*.json"

# View specific game
cat data/out/game1.json | jq '.annotation.summary'

# Count annotations
ls data/out/*.json | wc -l
```