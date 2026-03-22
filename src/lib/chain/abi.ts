import type { Abi } from "viem";
import waffleGameArtifact from "./abi.json";

export const waffleGameAbi = waffleGameArtifact.abi as unknown as Abi;
