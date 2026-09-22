from app.scoring.engine import DEFAULT_WEIGHTS, FACTOR_NAMES, compute_score


def test_weights_sum_and_names():
    assert sum(DEFAULT_WEIGHTS.values()) == 0.8 or abs(sum(DEFAULT_WEIGHTS.values()) - 0.8) < 1e-9
    assert set(FACTOR_NAMES) == set(DEFAULT_WEIGHTS)


def test_formula_all_ones_positive_zero_penalty():
    vals = {n: 1.0 for n in FACTOR_NAMES}
    vals["schedule_conflict_penalty"] = 0
    vals["workload_penalty"] = 0
    assert compute_score(vals)["score"] == 100


def test_formula_known_value():
    vals = {n: 0.5 for n in FACTOR_NAMES}
    # 0.5 * (1.0 - 0.2) = 0.4 -> 40
    assert compute_score(vals)["score"] == 40


def test_clamp_over_100():
    vals = {n: 5.0 for n in FACTOR_NAMES}
    vals["schedule_conflict_penalty"] = 0
    vals["workload_penalty"] = 0
    assert compute_score(vals)["score"] == 100


def test_clamp_negative():
    vals = {n: 0.0 for n in FACTOR_NAMES}
    vals["schedule_conflict_penalty"] = 1
    vals["workload_penalty"] = 1
    assert compute_score(vals)["score"] == 0
    vals2 = {n: -3.0 for n in FACTOR_NAMES}
    assert compute_score(vals2)["score"] == 0


def test_output_shape():
    out = compute_score({n: 0.5 for n in FACTOR_NAMES}, assumptions=["a"])
    assert len(out["components"]) == 9 and out["assumptions"] == ["a"] and "Scenario likelihood" in out["explanation"]
