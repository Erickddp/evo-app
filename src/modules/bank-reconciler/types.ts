export type BankMovement = {
    date: string;
    description: string;
    amount: number;
    type: "DEBIT" | "CREDIT";
};

export type PdfStatementSummary = {
    periodStart: string;
    periodEnd: string;
    accountNumber: string;
    startingBalance: number;
    endingBalance: number;
    totalCredits: number;
    totalDebits: number;
};

export type ParsedPdfResult = {
    movements: BankMovement[];
    summary: PdfStatementSummary;
};
