import { describe, expect, it } from "vitest";
import { computeScore, isCloseGuess, isCorrectGuess } from ".";

describe("isCorrectGuess", () => {
  it.each([
    ["Wine Glass", ["Wine glass"]],
    ["the teapots", ["Teapot"]],
    ["umbrela", ["Umbrella"]],
    ["xmas tree", ["Christmas tree", "xmas tree"]],
    ["  HAMER ", ["Hammer"]],
  ])("accepts %s", (guess, answers) => expect(isCorrectGuess(guess, answers)).toBe(true));

  it.each([
    ["mug", ["cup"]],
    ["cat", ["car"]],
    ["", ["chair"]],
  ])("rejects %s", (guess, answers) => expect(isCorrectGuess(guess, answers)).toBe(false));
});

describe("isCloseGuess", () => {
  it.each([
    ["chair", ["Office chair"]],
    ["wine bottle", ["Wine glass"]],
    ["hamr", ["Hammer"]],
  ])("warms %s", (guess, answers) => expect(isCloseGuess(guess, answers)).toBe(true));

  it.each([
    ["cat", ["car"]],
    ["toaster", ["Canoe"]],
    ["cup of tea", ["Bag of chips"]],
    ["", ["chair"]],
  ])("stays cold for %s", (guess, answers) => expect(isCloseGuess(guess, answers)).toBe(false));
});

describe("computeScore", () => {
  it("penalizes misses and hints, never below zero", () => {
    expect(computeScore(0, false)).toBe(100);
    expect(computeScore(2, true)).toBe(60);
    expect(computeScore(9, true)).toBe(0);
  });
});
