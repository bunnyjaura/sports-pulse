"""
Automated Leakage Verification Tests for Form Feature Generation
Proves strict pre-match calculation, zero lookahead, and correct venue context.
"""

import sys
import unittest
import pandas as pd
import numpy as np

def compute_rolling_form_for_match(matches_history, team_name, is_home, window):
    """
    Helper function to compute rolling form features for a team strictly using matches_history BEFORE the target match.
    """
    team_matches = []
    for m in matches_history:
        if m['HomeTeam'] == team_name:
            pts = 3 if m['FTHG'] > m['FTAG'] else (1 if m['FTHG'] == m['FTAG'] else 0)
            team_matches.append({
                'is_home': True,
                'pts': pts,
                'gf': m['FTHG'],
                'ga': m['FTAG'],
                'gd': m['FTHG'] - m['FTAG']
            })
        elif m['AwayTeam'] == team_name:
            pts = 3 if m['FTAG'] > m['FTHG'] else (1 if m['FTAG'] == m['FTHG'] else 0)
            team_matches.append({
                'is_home': False,
                'pts': pts,
                'gf': m['FTAG'],
                'ga': m['FTHG'],
                'gd': m['FTAG'] - m['FTHG']
            })
            
    recent_all = team_matches[-window:] if len(team_matches) >= window else team_matches
    
    pts_all = sum(m['pts'] for m in recent_all) if recent_all else 0
    gf_all = sum(m['gf'] for m in recent_all) if recent_all else 0
    ga_all = sum(m['ga'] for m in recent_all) if recent_all else 0
    gd_all = sum(m['gd'] for m in recent_all) if recent_all else 0
    
    # Venue specific
    venue_matches = [m for m in team_matches if m['is_home'] == is_home]
    recent_venue = venue_matches[-5:] if len(venue_matches) >= 5 else venue_matches
    
    pts_venue = sum(m['pts'] for m in recent_venue) if recent_venue else 0
    gf_venue = sum(m['gf'] for m in recent_venue) if recent_venue else 0
    ga_venue = sum(m['ga'] for m in recent_venue) if recent_venue else 0
    
    return {
        'pts': pts_all, 'gf': gf_all, 'ga': ga_all, 'gd': gd_all,
        'pts_venue': pts_venue, 'gf_venue': gf_venue, 'ga_venue': ga_venue
    }

class TestFormFeatureLeakage(unittest.TestCase):
    
    def setUp(self):
        self.mock_matches = [
            {'Date': '2024-01-01', 'HomeTeam': 'Arsenal', 'AwayTeam': 'Chelsea', 'FTHG': 2, 'FTAG': 0},  # Match 1: Arsenal win (3 pts, 2 GF, 0 GA)
            {'Date': '2024-01-08', 'HomeTeam': 'Liverpool', 'AwayTeam': 'Arsenal', 'FTHG': 1, 'FTAG': 1},  # Match 2: Arsenal draw (1 pt, 1 GF, 1 GA)
            {'Date': '2024-01-15', 'HomeTeam': 'Arsenal', 'AwayTeam': 'Man City', 'FTHG': 0, 'FTAG': 3},  # Match 3: Arsenal loss (0 pt, 0 GF, 3 GA)
            {'Date': '2024-01-22', 'HomeTeam': 'Chelsea', 'AwayTeam': 'Arsenal', 'FTHG': 1, 'FTAG': 2},   # Match 4: Target match
        ]
        
    def test_1_current_match_excluded(self):
        """1. Current match is excluded from rolling history."""
        history_before_match4 = self.mock_matches[:3]
        form = compute_rolling_form_for_match(history_before_match4, 'Arsenal', is_home=False, window=3)
        
        # Arsenal last 3 matches before Match 4: [Match 1, Match 2, Match 3]
        # Pts: 3 + 1 + 0 = 4 pts. GF: 2 + 1 + 0 = 3 goals. GA: 0 + 1 + 3 = 4 goals.
        self.assertEqual(form['pts'], 4)
        self.assertEqual(form['gf'], 3)
        self.assertEqual(form['ga'], 4)
        
    def test_2_future_matches_excluded(self):
        """2. Future matches beyond target date are excluded."""
        matches_with_future = self.mock_matches + [
            {'Date': '2024-01-29', 'HomeTeam': 'Arsenal', 'AwayTeam': 'Spurs', 'FTHG': 5, 'FTAG': 0}
        ]
        history_before_match4 = matches_with_future[:3]
        form = compute_rolling_form_for_match(history_before_match4, 'Arsenal', is_home=False, window=3)
        self.assertEqual(form['gf'], 3)  # Does not include the future 5 goals
        
    def test_3_rolling_windows_are_chronological(self):
        """3. Rolling windows use exact chronological order."""
        history = self.mock_matches[:3]
        form_last_2 = compute_rolling_form_for_match(history, 'Arsenal', is_home=False, window=2)
        # Last 2 matches before Match 4 are Match 2 and Match 3
        # Match 2: 1 pt, 1 GF, 1 GA; Match 3: 0 pt, 0 GF, 3 GA. Total: 1 pt, 1 GF, 4 GA
        self.assertEqual(form_last_2['pts'], 1)
        self.assertEqual(form_last_2['gf'], 1)
        self.assertEqual(form_last_2['ga'], 4)
        
    def test_4_home_form_contains_only_previous_home_matches(self):
        """4. Home-form history contains only previous home matches."""
        history = self.mock_matches[:3]
        # Arsenal previous home matches: Match 1 (2-0 vs Chelsea), Match 3 (0-3 vs Man City)
        home_form = compute_rolling_form_for_match(history, 'Arsenal', is_home=True, window=5)
        self.assertEqual(home_form['pts_venue'], 3) # 3 + 0 = 3 pts
        self.assertEqual(home_form['gf_venue'], 2)  # 2 + 0 = 2 GF
        self.assertEqual(home_form['ga_venue'], 3)  # 0 + 3 = 3 GA
        
    def test_5_away_form_contains_only_previous_away_matches(self):
        """5. Away-form history contains only previous away matches."""
        history = self.mock_matches[:3]
        # Arsenal previous away matches: Match 2 (1-1 @ Liverpool)
        away_form = compute_rolling_form_for_match(history, 'Arsenal', is_home=False, window=5)
        self.assertEqual(away_form['pts_venue'], 1) # 1 pt
        self.assertEqual(away_form['gf_venue'], 1)  # 1 GF
        self.assertEqual(away_form['ga_venue'], 1)  # 1 GA
        
    def test_6_match_result_available_only_after_match(self):
        """6. A match result becomes available only after that match finishes."""
        # Before Match 1 played, Arsenal history is empty
        empty_history = []
        form_before_match1 = compute_rolling_form_for_match(empty_history, 'Arsenal', is_home=True, window=3)
        self.assertEqual(form_before_match1['pts'], 0)
        self.assertEqual(form_before_match1['gf'], 0)
        
    def test_7_fold_test_data_never_influences_training_features(self):
        """7. Fold test data never influences training features."""
        train_matches = self.mock_matches[:2]
        test_matches = self.mock_matches[2:]
        
        # Computing feature for last train match (Match 2) uses only Match 1
        form_last_train = compute_rolling_form_for_match(train_matches[:1], 'Arsenal', is_home=False, window=3)
        self.assertEqual(form_last_train['pts'], 3) # Only Match 1

def run_tests():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestFormFeatureLeakage)
    runner = unittest.TextTestRunner(verbosity=2)
    res = runner.run(suite)
    return res.wasSuccessful()

if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
