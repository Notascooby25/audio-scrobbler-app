#!/usr/bin/env python3
"""
Generates high-fidelity standalone HTML files for:
- Version 1: Timeline (Modern Minimal / Light)
- Version 2: Sleeve (Editorial Vinyl / Dynamic Dark)
"""
import os
import sys

SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
MOCKUPS_DIR = os.path.join(SCRIPTS_DIR, "mockups")
os.makedirs(MOCKUPS_DIR, exist_ok=True)

# SVG Icons
SVG_HEART_RED = '<svg style="width:11px;height:11px;fill:#E11D48;display:inline-block;" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>'
SVG_HEART_OUTLINE = '<svg style="width:11px;height:11px;fill:none;stroke:#94A3B8;stroke-width:2;display:inline-block;" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>'
SVG_HEART_WHITE = '<svg style="width:11px;height:11px;fill:#FFFFFF;display:inline-block;" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>'
SVG_HEART_OUTLINE_WHITE = '<svg style="width:11px;height:11px;fill:none;stroke:rgba(255,255,255,0.45);stroke-width:2;display:inline-block;" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>'

SVG_BELL = '<svg style="width:12px;height:12px;display:inline-block;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>'
SVG_PULSE = '<svg style="width:12px;height:12px;display:inline-block;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>'
SVG_BARS = '<svg style="width:12px;height:12px;display:inline-block;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>'
SVG_PLAY = '<svg style="width:12px;height:12px;display:inline-block;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>'
SVG_TICKET = '<svg style="width:12px;height:12px;display:inline-block;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>'
SVG_CHECK = '<svg style="width:11px;height:11px;display:inline-block;" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>'
SVG_CHEVRON = '<svg style="width:10px;height:10px;display:inline-block;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>'
SVG_SEARCH = '<svg style="width:11px;height:11px;display:inline-block;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>'
SVG_REFRESH = '<svg style="width:11px;height:11px;display:inline-block;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>'

print("Generating Version 1 HTML...")
# We will write the full generator in the next step
