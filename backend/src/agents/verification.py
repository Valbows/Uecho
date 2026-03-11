"""
U:Echo — Verification Engine
Validates prompt schema completeness, safety checks, consistency,
and semantic drift scoring.
"""

from __future__ import annotations

import re

from ..api.models import PromptSchema, VerificationResult

# Drift threshold from extension constants (mirrored)
DRIFT_THRESHOLD = 0.80

# Blocked selectors / patterns for safety
BLOCKED_SELECTORS = frozenset([
    "html", "body", "head", "script", "style", "meta", "link",
    "iframe", "object", "embed", "applet", "*",
])

# Blocked action keywords in prompt text
BLOCKED_KEYWORDS = frozenset([
    "delete", "drop", "truncate", "exec(", "eval(", "document.cookie",
    "__proto__", "constructor.prototype",
])

# XSS / injection patterns in prompt text
XSS_PATTERNS = [
    re.compile(r'<\s*script', re.IGNORECASE),
    re.compile(r'javascript\s*:', re.IGNORECASE),
    re.compile(r'on\w+\s*=', re.IGNORECASE),  # onclick=, onerror=, etc.
    re.compile(r'data\s*:\s*text/html', re.IGNORECASE),
    re.compile(r'<\s*iframe', re.IGNORECASE),
    re.compile(r'<\s*object', re.IGNORECASE),
    re.compile(r'<\s*embed', re.IGNORECASE),
    re.compile(r'expression\s*\(', re.IGNORECASE),
    re.compile(r'url\s*\(\s*["\']?javascript', re.IGNORECASE),
]

# Limits
MAX_PROMPT_TEXT_LENGTH = 5000
MAX_SELECTOR_LENGTH = 200
MAX_SELECTOR_DEPTH = 10  # max combinators in a selector


def verify_prompt(prompt: PromptSchema, intent: str) -> VerificationResult:
    """
    Run the full verification pipeline on a built prompt.
    Returns a VerificationResult with pass/fail flags and diagnostics.
    """
    errors: list[str] = []
    warnings: list[str] = []

    schema_valid = _check_schema(prompt, errors)
    safety_passed = _check_safety(prompt, errors)
    consistency_passed = _check_consistency(prompt, warnings)
    drift_score = _compute_drift_score(prompt, intent)
    drift_warning = drift_score < DRIFT_THRESHOLD

    if drift_warning:
        warnings.append(
            f"Semantic drift score {drift_score:.2f} is below threshold {DRIFT_THRESHOLD}"
        )

    return VerificationResult(
        schema_valid=schema_valid,
        safety_passed=safety_passed,
        consistency_passed=consistency_passed,
        semantic_drift_score=drift_score,
        drift_warning=drift_warning,
        errors=errors,
        warnings=warnings,
    )


def _check_schema(prompt: PromptSchema, errors: list[str]) -> bool:
    """Validate required fields are populated."""
    valid = True

    if not prompt.feature_name.strip():
        errors.append("feature_name is empty")
        valid = False

    if not prompt.selector.strip():
        errors.append("selector is empty")
        valid = False

    if not prompt.action_type.strip():
        errors.append("action_type is empty")
        valid = False

    if not prompt.visual_change_description.strip():
        errors.append("visual_change_description is empty")
        valid = False

    if not prompt.prompt_text.strip():
        errors.append("prompt_text is empty")
        valid = False

    valid_actions = {"resize", "move", "color", "text", "spacing", "visibility"}
    if prompt.action_type not in valid_actions:
        errors.append(f"action_type '{prompt.action_type}' is not a recognized action")
        valid = False

    return valid


def _check_safety(prompt: PromptSchema, errors: list[str]) -> bool:
    """Check for dangerous selectors or injection patterns."""
    safe = True

    selector = prompt.selector.strip()

    # Selector length limit
    if len(selector) > MAX_SELECTOR_LENGTH:
        errors.append(f"Selector exceeds max length ({MAX_SELECTOR_LENGTH})")
        safe = False

    # Selector depth limit (count combinators)
    # Strip attribute selector contents using an iterative scanner that
    # correctly handles brackets/quotes inside attribute values,
    # e.g. [data="a]b"] or [title='[icon]'].
    parts: list[str] = []
    i = 0
    while i < len(selector):
        if selector[i] == '[':
            # Walk past the entire [...] block, respecting quotes
            quote_char = ''
            i += 1
            while i < len(selector):
                ch = selector[i]
                if quote_char:
                    if ch == '\\' and i + 1 < len(selector):
                        i += 2  # skip escaped char inside quotes
                        continue
                    if ch == quote_char:
                        quote_char = ''
                elif ch in ('"', "'"):
                    quote_char = ch
                elif ch == ']':
                    i += 1
                    break
                i += 1
            parts.append('[]')
        else:
            parts.append(selector[i])
            i += 1
    cleaned = ''.join(parts)
    # Normalize whitespace runs to a single space
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    # Count explicit combinators (> + ~) and whitespace descendant combinators
    combinator_count = len(re.findall(r'\s*[>+~]\s*|\s+', cleaned))
    if combinator_count > MAX_SELECTOR_DEPTH:
        errors.append(f"Selector depth {combinator_count} exceeds max ({MAX_SELECTOR_DEPTH})")
        safe = False

    # Check selector against blocklist — tokenize on CSS delimiters
    tokens = re.split(r'[\s>+~.,#:\[\]]+', selector.lower())
    for token in tokens:
        if token and token in BLOCKED_SELECTORS:
            errors.append(f"Selector targets blocked element: {token}")
            safe = False

    # Prompt text length limit
    if len(prompt.prompt_text) > MAX_PROMPT_TEXT_LENGTH:
        errors.append(f"Prompt text exceeds max length ({MAX_PROMPT_TEXT_LENGTH})")
        safe = False

    # Check prompt text for blocked keywords
    text_lower = prompt.prompt_text.lower()
    for keyword in BLOCKED_KEYWORDS:
        if keyword in text_lower:
            errors.append(f"Prompt text contains blocked keyword: {keyword}")
            safe = False

    # Check prompt text for XSS / injection patterns
    for pattern in XSS_PATTERNS:
        if pattern.search(prompt.prompt_text):
            errors.append(f"Prompt text matches XSS pattern: {pattern.pattern}")
            safe = False

    return safe


def _check_consistency(prompt: PromptSchema, warnings: list[str]) -> bool:
    """Cross-check prompt fields for internal consistency."""
    consistent = True

    # Action type should appear in the prompt text
    if prompt.action_type not in prompt.prompt_text.lower():
        warnings.append(
            f"action_type '{prompt.action_type}' not found in prompt_text"
        )
        # Not a hard failure, just a warning

    # Selector should appear in prompt text
    if prompt.selector.lower() not in prompt.prompt_text.lower():
        warnings.append("selector not referenced in prompt_text")

    # If resize, target dimensions should differ from current
    if prompt.action_type == "resize":
        current = prompt.current_dimensions
        target = prompt.target_dimensions
        if (
            target.width == current.width
            and target.height == current.height
        ):
            warnings.append("Resize action but target dimensions match current")
            consistent = False

    return consistent


def _compute_drift_score(prompt: PromptSchema, intent: str) -> float:
    """
    Compute a semantic similarity score between prompt and intent.
    Phase 8 will use real embeddings; for now use token overlap (Jaccard).
    """
    if not intent or not prompt.prompt_text:
        return 0.0

    intent_tokens = set(intent.lower().split())
    prompt_tokens = set(prompt.prompt_text.lower().split())

    if not intent_tokens or not prompt_tokens:
        return 0.0

    intersection = intent_tokens & prompt_tokens
    union = intent_tokens | prompt_tokens

    return len(intersection) / len(union) if union else 0.0
