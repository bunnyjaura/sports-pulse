"""
Dixon-Coles Goal Model Implementation
Includes time decay weighting exp(-xi * days) and low-score dependency correction tau(x, y).
Fixed xi = 0.001 (no hyperparameter tuning).
"""

import math
import numpy as np
import pandas as pd
from scipy.optimize import minimize

def dixon_coles_tau(x, y, lam, mu, rho):
    if x == 0 and y == 0:
        return 1.0 - (lam * mu * rho)
    elif x == 0 and y == 1:
        return 1.0 + (lam * rho)
    elif x == 1 and y == 0:
        return 1.0 + (mu * rho)
    elif x == 1 and y == 1:
        return 1.0 - rho
    else:
        return 1.0

class DixonColesModel:
    def __init__(self, xi=0.001):
        self.xi = xi
        self.teams = []
        self.team_indices = {}
        self.home_advantage = 0.25
        self.rho = -0.05
        self.attack_params = {}
        self.defence_params = {}
        
    def fit(self, train_matches, target_date=None):
        teams = sorted(list(set(train_matches['HomeTeam']).union(set(train_matches['AwayTeam']))))
        self.teams = teams
        self.team_indices = {t: i for i, t in enumerate(teams)}
        n_teams = len(teams)
        
        if target_date is None:
            max_date = train_matches['ParsedDate'].max()
        else:
            max_date = pd.to_datetime(target_date)
            
        days_ago = (max_date - train_matches['ParsedDate']).dt.days.clip(lower=0).values
        weights = np.exp(-self.xi * days_ago)
        
        init_params = np.zeros(2 + (n_teams - 1) + n_teams)
        init_params[0] = 0.25
        init_params[1] = -0.05
        
        home_idx_arr = np.array([self.team_indices[h] for h in train_matches['HomeTeam']])
        away_idx_arr = np.array([self.team_indices[a] for a in train_matches['AwayTeam']])
        fthg_arr = train_matches['FTHG'].values.astype(int)
        ftag_arr = train_matches['FTAG'].values.astype(int)
        
        def loss_func(params):
            home_adv = params[0]
            rho = params[1]
            att_free = params[2:n_teams+1]
            att = np.append(att_free, -np.sum(att_free))
            def_params = params[n_teams+1:]
            
            log_lam = home_adv + att[home_idx_arr] - def_params[away_idx_arr]
            log_mu = att[away_idx_arr] - def_params[home_idx_arr]
            
            lam = np.clip(np.exp(log_lam), 0.05, 10.0)
            mu = np.clip(np.exp(log_mu), 0.05, 10.0)
            
            taus = np.ones(len(train_matches))
            for k in range(len(train_matches)):
                x, y = fthg_arr[k], ftag_arr[k]
                l_k, m_k = lam[k], mu[k]
                taus[k] = max(0.001, dixon_coles_tau(x, y, l_k, m_k, rho))
                
            ll_h = fthg_arr * np.log(lam) - lam
            ll_a = ftag_arr * np.log(mu) - mu
            ll_tau = np.log(taus)
            
            total_ll = weights * (ll_h + ll_a + ll_tau)
            return -np.sum(total_ll)

        res = minimize(loss_func, init_params, method='L-BFGS-B')
        opt_params = res.x
        
        self.home_advantage = opt_params[0]
        self.rho = opt_params[1]
        att_free = opt_params[2:n_teams+1]
        att_full = np.append(att_free, -np.sum(att_free))
        def_full = opt_params[n_teams+1:]
        
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
                tau = max(0.001, dixon_coles_tau(i, j, lam, mu, self.rho))
                grid[i, j] = p_i * p_j * tau
                
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
