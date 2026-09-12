import { type Account, type PublicClient, type WalletClient } from 'viem';
export declare const ledgerAbi: readonly [{
    readonly name: "buyForMarket";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "marketId";
    }, {
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "bool";
        readonly name: "isLong";
    }, {
        readonly type: "uint256";
        readonly name: "usdcIn";
    }, {
        readonly type: "uint256";
        readonly name: "minTokensOut";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "buyExactTokensForMarket";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "marketId";
    }, {
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "bool";
        readonly name: "isLong";
    }, {
        readonly type: "uint256";
        readonly name: "t";
    }, {
        readonly type: "uint256";
        readonly name: "maxUSDCIn";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "getMarketPositions";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "marketId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256[]";
    }];
}, {
    readonly name: "getPricingMM";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "marketId";
    }];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "realFreeCollateral";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "account";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "getLongAndShortBalances";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "account";
    }, {
        readonly type: "uint256";
        readonly name: "marketId";
    }, {
        readonly type: "uint256";
        readonly name: "positionId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "longBalance";
    }, {
        readonly type: "uint256";
        readonly name: "shortBalance";
    }];
}, {
    readonly name: "heldPositions";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "account";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256[]";
    }];
}, {
    readonly name: "getPositionLiquidity";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "account";
    }, {
        readonly type: "uint256";
        readonly name: "marketId";
    }, {
        readonly type: "uint256";
        readonly name: "positionId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "realFreeCollateral";
    }, {
        readonly type: "int256";
        readonly name: "marketExposure";
    }, {
        readonly type: "int256";
        readonly name: "tilt";
    }];
}, {
    readonly name: "getMinTilt";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "account";
    }, {
        readonly type: "uint256";
        readonly name: "marketId";
    }];
    readonly outputs: readonly [{
        readonly type: "int256";
        readonly name: "minTilt";
    }, {
        readonly type: "uint256";
        readonly name: "minPositionId";
    }];
}, {
    readonly name: "pendingYield";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "account";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "eusdcBalance";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "account";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "amount";
    }];
}, {
    readonly name: "getPositionDetails";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "marketId";
    }, {
        readonly type: "uint256";
        readonly name: "positionId";
    }];
    readonly outputs: readonly [{
        readonly type: "string";
        readonly name: "name";
    }, {
        readonly type: "string";
        readonly name: "ticker";
    }];
}, {
    readonly name: "ladderPpmOf";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "positionId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint32";
    }];
}, {
    readonly name: "ladderSyncedIndex";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "bool";
        readonly name: "synced";
    }, {
        readonly type: "uint256";
        readonly name: "index";
    }];
}, {
    readonly name: "positionWrapper";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "marketId";
    }, {
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "bool";
        readonly name: "isLong";
    }];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "positionWrapperOf";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "account";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}];
export declare const oracleAbi: readonly [{
    readonly name: "latest";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
        readonly name: "index";
    }, {
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint64";
            readonly name: "timestamp";
        }, {
            readonly type: "uint256";
            readonly name: "packedOrder";
        }];
        readonly name: "e";
    }];
}, {
    readonly name: "orderAt";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "i";
    }];
    readonly outputs: readonly [{
        readonly type: "uint16[]";
        readonly name: "order";
    }];
}, {
    readonly name: "rowsAt";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "i";
    }];
    readonly outputs: readonly [{
        readonly type: "uint16[]";
        readonly name: "order";
    }, {
        readonly type: "uint16[]";
        readonly name: "points";
    }, {
        readonly type: "int16[]";
        readonly name: "goalDifference";
    }, {
        readonly type: "uint16[]";
        readonly name: "goalsFor";
    }, {
        readonly type: "uint16[]";
        readonly name: "played";
    }];
}];
export declare const booksAbi: readonly [{
    readonly name: "bookOf";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "account";
    }, {
        readonly type: "uint256";
        readonly name: "marketId";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "freeCollateral";
        }, {
            readonly type: "int256";
            readonly name: "marketExposure";
        }, {
            readonly type: "int256";
            readonly name: "minTilt";
        }, {
            readonly type: "uint256";
            readonly name: "minTiltPositionId";
        }, {
            readonly type: "uint256";
            readonly name: "minTiltShort";
        }, {
            readonly type: "uint256";
            readonly name: "pendingYield";
        }, {
            readonly type: "uint256";
            readonly name: "positionsScanned";
        }, {
            readonly type: "tuple[]";
            readonly components: readonly [{
                readonly type: "uint256";
                readonly name: "positionId";
            }, {
                readonly type: "int256";
                readonly name: "tilt";
            }, {
                readonly type: "uint256";
                readonly name: "longBalance";
            }, {
                readonly type: "uint256";
                readonly name: "shortBalance";
            }];
            readonly name: "native";
        }, {
            readonly type: "tuple[]";
            readonly components: readonly [{
                readonly type: "uint256";
                readonly name: "positionId";
            }, {
                readonly type: "address";
                readonly name: "longToken";
            }, {
                readonly type: "uint256";
                readonly name: "longBalance";
            }, {
                readonly type: "address";
                readonly name: "shortToken";
            }, {
                readonly type: "uint256";
                readonly name: "shortBalance";
            }];
            readonly name: "wrapped";
        }];
        readonly name: "book";
    }];
}];
export declare const erc20Abi: readonly [{
    readonly name: "balanceOf";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "account";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "totalSupply";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}];
export declare const tradeEvent: {
    readonly name: "MMPricedTrade";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "uint8";
        readonly name: "kind";
    }, {
        readonly type: "address";
        readonly name: "trader";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "mm";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "marketId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "bool";
        readonly name: "isLong";
    }, {
        readonly type: "uint256";
        readonly name: "baseAmount";
    }, {
        readonly type: "uint256";
        readonly name: "quoteAmount";
    }, {
        readonly type: "uint256";
        readonly name: "primaryAmount";
    }, {
        readonly type: "uint256";
        readonly name: "bound";
    }];
};
export declare const deltaEvent: {
    readonly name: "PositionDelta";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "account";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "marketId";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "positionId";
        readonly indexed: true;
    }, {
        readonly type: "int256";
        readonly name: "delta";
    }, {
        readonly type: "int256";
        readonly name: "newTilt";
    }];
};
export declare const transferEvent: {
    readonly name: "Transfer";
    readonly type: "event";
    readonly inputs: readonly [{
        readonly type: "address";
        readonly name: "from";
        readonly indexed: true;
    }, {
        readonly type: "address";
        readonly name: "to";
        readonly indexed: true;
    }, {
        readonly type: "uint256";
        readonly name: "value";
    }];
};
export declare const makerAbi: readonly [{
    readonly name: "getAllLongPricesWad";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "marketId";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256[]";
        readonly name: "positionIds";
    }, {
        readonly type: "uint256[]";
        readonly name: "priceWads";
    }, {
        readonly type: "uint256";
        readonly name: "reservePriceWad";
    }];
}, {
    readonly name: "previewBuyExactTokensFull";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "marketId";
    }, {
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "bool";
        readonly name: "isLong";
    }, {
        readonly type: "uint256";
        readonly name: "tokens";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "amount";
        }, {
            readonly type: "uint256[]";
            readonly name: "positionIds";
        }, {
            readonly type: "uint256[]";
            readonly name: "longBeforeWad";
        }, {
            readonly type: "uint256[]";
            readonly name: "longAfterWad";
        }, {
            readonly type: "uint256";
            readonly name: "reserveBeforeWad";
        }, {
            readonly type: "uint256";
            readonly name: "reserveAfterWad";
        }];
    }];
}, {
    readonly name: "previewBuyForUSDCFull";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly type: "uint256";
        readonly name: "marketId";
    }, {
        readonly type: "uint256";
        readonly name: "positionId";
    }, {
        readonly type: "bool";
        readonly name: "isLong";
    }, {
        readonly type: "uint256";
        readonly name: "usdcIn";
    }];
    readonly outputs: readonly [{
        readonly type: "tuple";
        readonly components: readonly [{
            readonly type: "uint256";
            readonly name: "amount";
        }, {
            readonly type: "uint256[]";
            readonly name: "positionIds";
        }, {
            readonly type: "uint256[]";
            readonly name: "longBeforeWad";
        }, {
            readonly type: "uint256[]";
            readonly name: "longAfterWad";
        }, {
            readonly type: "uint256";
            readonly name: "reserveBeforeWad";
        }, {
            readonly type: "uint256";
            readonly name: "reserveAfterWad";
        }];
    }];
}];
export declare const parseTokens: (count: number) => bigint;
export declare const parseUSDC: (amount: number) => bigint;
export declare function resolveTrade(idx: number, board: {
    clubs?: ({
        name: string;
    } | undefined)[];
}, priced: {
    positionIds: (number | bigint)[];
    prices: (number | null)[];
}): {
    positionId: bigint;
    price: number;
    label: string;
};
export declare function clients(account?: Account): {
    publicClient: PublicClient;
    walletClient: WalletClient | undefined;
};
export declare function sendTrade(wallet: WalletClient, account: Account, trade: {
    positionId: bigint;
    isLong: boolean;
    usdcIn?: bigint;
    minTokensOut?: bigint;
    tokens?: bigint;
    maxUSDCIn?: bigint;
}): Promise<`0x${string}`>;
export declare function chainPrices(client: PublicClient): Promise<{
    positionIds: number[];
    prices: number[];
}>;
