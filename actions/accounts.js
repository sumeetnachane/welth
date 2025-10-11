"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { success } from "zod";

const serializeTransaction = (obj) => {
  const serialized = { ...obj };

  if (obj.balance) {
    serialized.balance = obj.balance.toNumber(); // transactions will be decimal form so next step obj.amount
  }
  if (obj.amount) {
    serialized.amount = obj.amount.toNumber(); //automatic decimal convert into number
  }
  return serialized;
};

export async function updateDefaultAccount(accountId) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Unset any existing account
    //If this account should be default, unset other default accounts
    await db.account.updateMany({
      where: { userId: user.id, isDefault: true },
      data: { isDefault: false },
    });

    //Update Account now
    const account = await db.account.update({
      where: {
        id: accountId,
        userId: user.id,
      },
      data: { isDefault: true },
    });

    revalidatePath("/dashboard");
    return { success: true, data: serializeTransaction(account) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// getAccountWithTransactions is like current account or saving account
export async function getAccountWithTransactions(accountId) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const account = await db.account.findUnique({
    where: { id: accountId, userId: user.id },
    include: {
      transactions: {
        orderBy: { date: "desc" },
      },
      //count all of transactions here
      _count: {
        select: { transactions: true },
      },
    },
  });
  if (!account) return null;

  return {
    ...serializeTransaction(account), //convert all decimal into the number
    transactions: account.transactions.map(serializeTransaction),
  };
}

// Ye ek bulk delete API/service function hai jo ek saath multiple transactions ko delete karta hai aur unke corresponding account balances ko adjust bhi karta hai.
export async function bulkDeleteTransactions(transactionIds) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) throw new Error("User not found");

    // Get all transactions that need to be deleted
    // Get transactions to calculate balance changes
    const transactions = await db.transaction.findMany({
      where: {
        id: { in: transactionIds }, //get all transaction from db
        userId: user.id, // ensure to fetch current users transaction
      },
    });

    // Group transactions by account to update balances
    //acc = accumulator
    const accountBalanceChanges = transactions.reduce((acc, transaction) => {
      const change =
        transaction.type === "EXPENSE" // if expense delete kiya to amount add ho jayegi expense - krta hai delete ke baad add ho jayega amt account balance me (total balance me)
          ? transaction.amount
          : -transaction.amount;
      acc[transaction.accountId] = (acc[transaction.accountId] || 0) + change;
      return acc;
    }, {});

    // Delete transactions and update account balances in a transaction
    // Perform DB transaction (atomic operation)
    await db.$transaction(async (tx) => {
      // Delete transactions
      await tx.transaction.deleteMany({
        where: {
          id: { in: transactionIds },
          userId: user.id,
        },
      });

      // Update account balances
      for (const [accountId, balanceChange] of Object.entries(
        accountBalanceChanges
      )) {
        await tx.account.update({
          where: { id: accountId },
          data: {
            balance: {
              increment: balanceChange,
            },
          },
        });
      }
    });

    revalidatePath("/dashboard");
    revalidatePath("/account/[id]");

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
