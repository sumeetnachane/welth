"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function getCurrentBudget(accountId) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) throw new Error("User not found");

    const budget = await db.budget.findFirst({
      where: {
        userId: user.id,
      },
    });

    // Get current month's expenses
    const currentDate = new Date();

    const startOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );

    const endOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1, // means end after 1 month
      0
    );

    const expenses = await db.transaction.aggregate({
      // where: Ye filter conditions hain (sirf iss user ke, iss account ke, iss month ke EXPENSE transactions).
      where: {
        userId: user.id,
        type: "EXPENSE",
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
        accountId,
      },
      _sum: {
        // Ye bol raha hai: "jitne bhi filtered transactions mile, unke amount ko add karke ek total de do". _sum hai to sum milega
        amount: true,
      },
    });

    return {
      budget: budget ? { ...budget, amount: budget.amount.toNumber() } : null, //converting decimal to the number toNumber()
      currentExpenses: expenses._sum.amount
        ? expenses._sum.amount.toNumber()
        : 0,
    };
  } catch (error) {
    console.error("Error Fetching Budget:", error);
    throw error;
  }
}

export async function updateBudget(amount) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) throw new Error("User not found");

    // Update or create budget
    const budget = await db.budget.upsert({
      where: {
        userId: user.id,
      },
      update: {
        amount,
      },
      create: {
        userId: user.id,
        amount,
      },
    });

    revalidatePath("/dashboard");
    return {
      success: true,
      data: { ...budget, amount: budget.amount.toNumber() },
    };
  } catch (error) {
    console.error("Error updating budget:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}
