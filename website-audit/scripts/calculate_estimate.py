#!/usr/bin/env python3
"""
Drupal Project Estimation Calculator

This script calculates project estimates based on entity counts and complexity.
Uses the bottom-up estimation method with multipliers.

Usage:
    python calculate_estimate.py <entities_json>

Example entities.json:
{
    "content_types": [
        {"name": "Page", "complexity": "simple"},
        {"name": "Article", "complexity": "medium"}
    ],
    "paragraphs": [
        {"name": "Text", "complexity": "simple"},
        {"name": "Hero", "complexity": "complex"}
    ],
    "multipliers": {
        "testing": 0.25,
        "documentation": 0.15,
        "multilingual": 0.30
    },
    "migration": {
        "nodes": 500,
        "complexity": "medium"
    },
    "risk_level": "medium"
}
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Any, Tuple
from dataclasses import dataclass, asdict


@dataclass
class EntityEstimate:
    """Estimation for a single entity."""
    name: str
    type: str
    complexity: str
    hours: float


@dataclass
class EstimationResult:
    """Complete estimation result."""
    base_hours: float
    multiplier_hours: float
    migration_hours: float
    additional_hours: float
    subtotal: float
    buffer_hours: float
    total_hours: float
    entity_breakdown: List[EntityEstimate]
    multipliers_applied: Dict[str, float]
    assumptions: List[str]
    risks: List[str]


# Estimation tables (hours)
ESTIMATION_TABLE = {
    "content_type": {"simple": 3, "medium": 6, "complex": 12},
    "paragraph": {"simple": 1.5, "medium": 3.5, "complex": 6},
    "taxonomy": {"simple": 1.5, "medium": 3, "complex": 6},
    "media_type": {"simple": 1.5, "medium": 3, "complex": 3.5},
    "view": {"simple": 3, "medium": 6, "complex": 12},
    "webform": {"simple": 3, "medium": 6, "complex": 12},
    "block": {"simple": 1.5, "medium": 3, "complex": 6},
    "custom_module": {"simple": 12, "medium": 28, "complex": 70},
    "theme_component": {"simple": 3, "medium": 6, "complex": 12},
}

# Migration effort (per 100 nodes)
MIGRATION_BASE = 10
MIGRATION_MULTIPLIERS = {
    "simple": 1.0,
    "medium": 2.0,
    "complex": 3.5,
}

# Additional effort (fixed hours)
ADDITIONAL_EFFORT = {
    "infrastructure_setup": 60,
    "training_handover": 30,
}

# Buffer percentages
BUFFER_PERCENTAGES = {
    "low": 0.15,
    "medium": 0.20,
    "high": 0.25,
}


def calculate_entity_hours(entity: Dict[str, str], entity_type: str) -> EntityEstimate:
    """Calculate hours for a single entity."""
    name = entity.get("name", "Unknown")
    complexity = entity.get("complexity", "medium").lower()

    if entity_type not in ESTIMATION_TABLE:
        raise ValueError(f"Unknown entity type: {entity_type}")

    hours = ESTIMATION_TABLE[entity_type].get(complexity, 0)

    return EntityEstimate(
        name=name,
        type=entity_type,
        complexity=complexity,
        hours=hours
    )


def calculate_base_hours(entities: Dict[str, List[Dict]]) -> Tuple[float, List[EntityEstimate]]:
    """Calculate base hours from entity inventory."""
    total_hours = 0.0
    breakdown = []

    entity_type_map = {
        "content_types": "content_type",
        "paragraphs": "paragraph",
        "taxonomies": "taxonomy",
        "media_types": "media_type",
        "views": "view",
        "webforms": "webform",
        "blocks": "block",
        "custom_modules": "custom_module",
        "theme_components": "theme_component",
    }

    for key, entity_type in entity_type_map.items():
        if key in entities:
            for entity in entities[key]:
                estimate = calculate_entity_hours(entity, entity_type)
                breakdown.append(estimate)
                total_hours += estimate.hours

    return total_hours, breakdown


def calculate_migration_hours(migration_config: Dict[str, Any]) -> float:
    """Calculate migration effort."""
    if not migration_config:
        return 0.0

    base_setup = 30  # Base migration setup hours
    nodes = migration_config.get("nodes", 0)
    complexity = migration_config.get("complexity", "medium").lower()

    if nodes == 0:
        return 0.0

    multiplier = MIGRATION_MULTIPLIERS.get(complexity, 2.0)
    hours_per_100 = MIGRATION_BASE * multiplier
    node_hours = (nodes / 100) * hours_per_100

    return base_setup + node_hours


def apply_multipliers(base_hours: float, multipliers: Dict[str, float]) -> Tuple[float, Dict[str, float]]:
    """Apply percentage multipliers to base hours."""
    total_multiplier_hours = 0.0
    applied = {}

    for key, percentage in multipliers.items():
        hours = base_hours * percentage
        applied[key] = hours
        total_multiplier_hours += hours

    return total_multiplier_hours, applied


def calculate_pm_hours(subtotal: float, pm_percentage: float = 0.18) -> float:
    """Calculate project management hours."""
    return subtotal * pm_percentage


def calculate_estimate(entities_data: Dict[str, Any]) -> EstimationResult:
    """Calculate complete project estimate."""
    # Base hours
    base_hours, breakdown = calculate_base_hours(entities_data)

    # Multipliers
    multipliers = entities_data.get("multipliers", {})
    multiplier_hours, applied_multipliers = apply_multipliers(base_hours, multipliers)

    # Migration
    migration_config = entities_data.get("migration", {})
    migration_hours = calculate_migration_hours(migration_config)

    # Additional effort
    infrastructure = ADDITIONAL_EFFORT["infrastructure_setup"]
    training = ADDITIONAL_EFFORT["training_handover"]

    # PM hours (calculated on subtotal before buffer)
    subtotal_before_pm = base_hours + multiplier_hours + migration_hours + infrastructure + training
    pm_hours = calculate_pm_hours(subtotal_before_pm)

    additional_hours = infrastructure + training + pm_hours

    # Subtotal
    subtotal = subtotal_before_pm + pm_hours

    # Buffer
    risk_level = entities_data.get("risk_level", "medium").lower()
    buffer_percentage = BUFFER_PERCENTAGES.get(risk_level, 0.20)
    buffer_hours = subtotal * buffer_percentage

    # Total
    total_hours = subtotal + buffer_hours

    # Assumptions and risks
    assumptions = entities_data.get("assumptions", [
        "Requirements are clearly defined",
        "Team has Drupal experience",
        "Standard development practices followed",
        "No major scope changes expected"
    ])

    risks = entities_data.get("risks", [
        "Requirements may evolve during development",
        "Migration complexity may be higher than assessed",
        "Third-party integrations may require additional effort"
    ])

    return EstimationResult(
        base_hours=base_hours,
        multiplier_hours=multiplier_hours,
        migration_hours=migration_hours,
        additional_hours=additional_hours,
        subtotal=subtotal,
        buffer_hours=buffer_hours,
        total_hours=total_hours,
        entity_breakdown=breakdown,
        multipliers_applied=applied_multipliers,
        assumptions=assumptions,
        risks=risks
    )


def format_breakdown_table(breakdown: List[EntityEstimate]) -> str:
    """Format entity breakdown as markdown table."""
    # Group by type
    by_type = {}
    for entity in breakdown:
        if entity.type not in by_type:
            by_type[entity.type] = []
        by_type[entity.type].append(entity)

    output = []
    for entity_type, entities in by_type.items():
        output.append(f"\n### {entity_type.replace('_', ' ').title()}\n")
        output.append("| Name | Complexity | Hours |")
        output.append("|------|-----------|-------|")
        for entity in entities:
            output.append(f"| {entity.name} | {entity.complexity.title()} | {entity.hours:.1f} |")

        subtotal = sum(e.hours for e in entities)
        output.append(f"| **Subtotal** | | **{subtotal:.1f}** |")

    return "\n".join(output)


def format_estimation_report(result: EstimationResult, entities_data: Dict[str, Any]) -> str:
    """Format complete estimation report."""
    project_name = entities_data.get("project_name", "Website Audit")

    report = f"""# Project Estimation Report: {project_name}

## Summary

| Metric | Hours | % of Total |
|--------|-------|-----------|
| Base Hours (Entities) | {result.base_hours:.1f} | {(result.base_hours/result.total_hours*100):.1f}% |
| Multipliers | {result.multiplier_hours:.1f} | {(result.multiplier_hours/result.total_hours*100):.1f}% |
| Migration | {result.migration_hours:.1f} | {(result.migration_hours/result.total_hours*100):.1f}% |
| Additional Effort | {result.additional_hours:.1f} | {(result.additional_hours/result.total_hours*100):.1f}% |
| Subtotal | {result.subtotal:.1f} | {(result.subtotal/result.total_hours*100):.1f}% |
| Buffer ({entities_data.get('risk_level', 'medium').title()}) | {result.buffer_hours:.1f} | {(result.buffer_hours/result.total_hours*100):.1f}% |
| **TOTAL ESTIMATE** | **{result.total_hours:.1f}** | **100%** |

## Timeline Projections

### Full-time (40h/week)
- **Weeks:** {result.total_hours/40:.1f}
- **Months:** {result.total_hours/160:.1f}

### Realistic (30h/week)
- **Weeks:** {result.total_hours/30:.1f}
- **Months:** {result.total_hours/120:.1f}

### Part-time (20h/week)
- **Weeks:** {result.total_hours/20:.1f}
- **Months:** {result.total_hours/80:.1f}

## Estimate Ranges

| Confidence | Hours | Timeline (30h/week) |
|-----------|-------|---------------------|
| Optimistic (Base) | {result.base_hours:.0f} | {result.base_hours/120:.1f} months |
| Likely (Recommended) | {result.total_hours:.0f} | {result.total_hours/120:.1f} months |
| Pessimistic (+30%) | {result.total_hours*1.3:.0f} | {result.total_hours*1.3/120:.1f} months |

**Recommendation:** Use the "Likely" estimate for planning and budgeting.

---

## Detailed Breakdown

### Base Hours by Entity Type

{format_breakdown_table(result.entity_breakdown)}

**Total Base Hours:** {result.base_hours:.1f}

---

### Multipliers Applied

| Multiplier | Percentage | Hours |
|-----------|-----------|-------|
"""

    for key, hours in result.multipliers_applied.items():
        percentage = (hours / result.base_hours) * 100
        report += f"| {key.replace('_', ' ').title()} | {percentage:.0f}% | {hours:.1f} |\n"

    report += f"""
**Total Multipliers:** {result.multiplier_hours:.1f} hours

---

### Migration Effort

"""

    migration = entities_data.get("migration", {})
    if migration and migration.get("nodes", 0) > 0:
        report += f"""
- **Content Volume:** {migration.get('nodes', 0):,} nodes
- **Complexity:** {migration.get('complexity', 'medium').title()}
- **Base Setup:** 30 hours
- **Migration Hours:** {result.migration_hours:.1f} hours
"""
    else:
        report += "No migration required.\n"

    report += f"""
---

### Additional Effort

| Item | Hours |
|------|-------|
| Infrastructure Setup | {ADDITIONAL_EFFORT['infrastructure_setup']:.1f} |
| Training & Handover | {ADDITIONAL_EFFORT['training_handover']:.1f} |
| Project Management (18%) | {result.additional_hours - ADDITIONAL_EFFORT['infrastructure_setup'] - ADDITIONAL_EFFORT['training_handover']:.1f} |
| **Total Additional** | **{result.additional_hours:.1f}** |

---

### Buffer for Unknowns

- **Risk Level:** {entities_data.get('risk_level', 'medium').title()}
- **Buffer Percentage:** {BUFFER_PERCENTAGES.get(entities_data.get('risk_level', 'medium').lower(), 0.20)*100:.0f}%
- **Buffer Hours:** {result.buffer_hours:.1f}

---

## Assumptions

"""

    for i, assumption in enumerate(result.assumptions, 1):
        report += f"{i}. {assumption}\n"

    report += """
---

## Risks

"""

    for i, risk in enumerate(result.risks, 1):
        report += f"{i}. {risk}\n"

    report += """
---

## Validation

This estimate was calculated using:
- **Method:** Bottom-up estimation with multipliers
- **Baseline:** adessoCMS Drupal 11 project
- **Tool:** website-audit skill for Claude Code

**Next Steps:**
1. Review entity breakdown for accuracy
2. Validate complexity classifications
3. Confirm multipliers are appropriate
4. Assess risk level
5. Compare to baseline (if available)

---

*Generated: """ + entities_data.get("audit_date", "2025-11-13") + "*"

    return report


def main():
    """Main execution function."""
    if len(sys.argv) < 2:
        print("Usage: python calculate_estimate.py <entities_json>")
        print("\nExample:")
        print("  python calculate_estimate.py ./audit_data/entities.json")
        sys.exit(1)

    input_file = Path(sys.argv[1])
    if not input_file.exists():
        print(f"Error: File not found: {input_file}")
        sys.exit(1)

    # Load entities data
    with open(input_file, 'r') as f:
        entities_data = json.load(f)

    print(f"🧮 Calculating estimate for: {entities_data.get('project_name', 'Website Audit')}\n")

    # Calculate estimate
    result = calculate_estimate(entities_data)

    # Format report
    report = format_estimation_report(result, entities_data)

    # Save report
    output_file = input_file.parent / "estimation_report.md"
    output_file.write_text(report)

    print(f"✅ Estimation complete!\n")
    print(f"📊 Total Hours: {result.total_hours:.1f}")
    print(f"📅 Timeline (30h/week): {result.total_hours/120:.1f} months")
    print(f"💰 Cost (€100/h): €{result.total_hours*100:,.0f}")
    print(f"\n📄 Report saved to: {output_file}")

    # Also save JSON
    json_output = input_file.parent / "estimation_result.json"
    json_data = {
        "summary": {
            "total_hours": result.total_hours,
            "base_hours": result.base_hours,
            "multiplier_hours": result.multiplier_hours,
            "migration_hours": result.migration_hours,
            "additional_hours": result.additional_hours,
            "buffer_hours": result.buffer_hours,
        },
        "breakdown": [asdict(e) for e in result.entity_breakdown],
        "multipliers": result.multipliers_applied,
        "assumptions": result.assumptions,
        "risks": result.risks,
    }
    with open(json_output, 'w') as f:
        json.dump(json_data, f, indent=2)

    print(f"📊 JSON data saved to: {json_output}")


if __name__ == "__main__":
    main()
