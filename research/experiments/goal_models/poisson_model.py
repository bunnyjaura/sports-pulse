"""
Independent Poisson Goal Model Implementation
Estimates expected home goals (lambda) and expected away goals (mu) using maximum likelihood estimation.
Formulation:
  log(lambda) = home_advantage + attack_home - defence_away
  log(mu) = attack_away - defence_home
Zero sum constraint: sum(attack) = 0
"""

import math
import numpy as np
import pandas as pd
from scipy.optimize import minimize

class IndependentPoissonModel:
    def __init__(self):
        self.teams = []
        self.team_indices = {}
        self.params = None
        self.home_advantage = 0.25
        self.attack_params = {}
        self.defence_params = {}
        
    def fit(self, train_matches):
        teams = sorted(list(set(train_matches['HomeTeam']).union(set(train_matches['AwayTeam']))))
        self.teams = teams
        self.team_indices = {t: i for i, t in enumerate(teams)}
        n_teams = len(teams)
        
        init_params = np.zeros(1 + (n_teams - 1) + n_teams)
        init_params[0] = 0.25
        
        home_idx_arr = np.array([self.team_indices[h] for h in train_matches['HomeTeam']])
        away_idx_arr = np.array([self.team_indices[a] for a in train_matches['AwayTeam']])
        fthg_arr = train_matches['FTHG'].values.astype(float)
        ftag_arr = train_matches['FTAG'].values.astype(float)
        
        def loss_func(params):
            home_adv = params[0]
            att_free = params[1:n_teams]
            att = np.append(att_free, -np.sum(att_free))
            def_params = params[n_teams:]
            
            log_lam = home_adv + att[home_idx_arr] - def_params[away_idx_arr]
            log_mu = att[away_idx_arr] - def_params[home_idx_arr]
            
            lam = np.clip(np.exp(log_lam), 0.05, 10.0)
            mu = np.clip(np.exp(log_mu), 0.05, 10.0)
            
            ll_h = fthg_arr * np.log(lam) - lam
            ll_a = ftag_arr * np.log(mu) - mu
            
            return -np.sum(ll_h + ll_a)

        res = minimize(loss_func, init_params, method='L-BFGS-B')
        opt_params = res.x
        
        self.home_advantage = opt_params[0]
        att_free = opt_params[1:n_teams]
        att_full = np.append(att_free, -np.sum(att_free))
        def_full = opt_params[n_teams:]
        
        for i, t in enumerate(teams):
            self.attack_params[t] = float(att_full[i])
            self.defence_params[t] = float(def_full[i])

    def predict_lambdas(self, home_team, away_team):
        default_att = 0.0
        default_def = 0.0
        
        att_h = self.attack_params.get(home_team, default_att)
        def_a = self.defence_params.get(away_team, default_def)
        att_a = self.attack_params.get(away_team, default_att)
        def_h = self.defence_params.get(home_team, default_def)
        
        log_lam = self.home_advantage + att_h - def_a
        log_mu = att_a - def_h
        
        lam = float(np.clip(np.exp(log_lam), 0.1, 8.0))
        mu = float(np.clip(np.exp(log_mu), 0.1, 8.0))
        return lam, mu

    def predict_probabilities(self, home_team, away_team, max_goals=10):
        lam, mu = self.predict_lambdas(home_team, away_team)
        
        grid = np.zeros((max_goals + 1, max_goals + 1))
        for i in range(max_goals + 1):
            for j in range(max_goals + 1):
                p_i = (lam ** i) * math.exp(-lam) / math.factorial(i)
                p_j = (mu ** j) * math.exp(-mu) / math.factorial(j)
                grid[i, j] = p_i * p_j
                
        grid /= np.sum(grid)
        
        p_home = float(np.sum(np.tril(grid, -1)))
        p_draw = float(np.sum(np.diag(grid)))
        p_away = float(np.sum(np.triu(grid, 1)))
        
        probs = np.array([p_home, p_draw, p_away])
        probs /= np.sum(probs)
        
        return {
            'expected_goals_home': round(lam, 3),
            'expected_goals_away': round(mu, 3),
            'probabilities': probs,
            'grid': grid
        }
