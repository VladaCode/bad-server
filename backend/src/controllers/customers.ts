import { NextFunction, Request, Response } from 'express'
import { FilterQuery } from 'mongoose'
import NotFoundError from '../errors/not-found-error'
import Order from '../models/order'
import User, { IUser } from '../models/user'
import { normalizePagination, normalizeSearchRegex } from '../utils/sanitizers'

const toNumber = (value: unknown): number | null => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
}

const toDate = (value: unknown): Date | null => {
    if (typeof value !== 'string') {
        return null
    }

    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
}

export const getCustomers = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const {
            page,
            limit,
            sortField = 'createdAt',
            sortOrder = 'desc',
            registrationDateFrom,
            registrationDateTo,
            lastOrderDateFrom,
            lastOrderDateTo,
            totalAmountFrom,
            totalAmountTo,
            orderCountFrom,
            orderCountTo,
            search,
        } = req.query

        const pagination = normalizePagination(page, limit, 10, 10)
        const filters: FilterQuery<Partial<IUser>> = {}

        const registrationFrom = toDate(registrationDateFrom)
        if (registrationFrom) {
            filters.createdAt = {
                ...filters.createdAt,
                $gte: registrationFrom,
            }
        }

        const registrationTo = toDate(registrationDateTo)
        if (registrationTo) {
            registrationTo.setHours(23, 59, 59, 999)
            filters.createdAt = {
                ...filters.createdAt,
                $lte: registrationTo,
            }
        }

        const lastOrderFrom = toDate(lastOrderDateFrom)
        if (lastOrderFrom) {
            filters.lastOrderDate = {
                ...filters.lastOrderDate,
                $gte: lastOrderFrom,
            }
        }

        const lastOrderTo = toDate(lastOrderDateTo)
        if (lastOrderTo) {
            lastOrderTo.setHours(23, 59, 59, 999)
            filters.lastOrderDate = {
                ...filters.lastOrderDate,
                $lte: lastOrderTo,
            }
        }

        const totalFrom = toNumber(totalAmountFrom)
        if (totalFrom !== null) {
            filters.totalAmount = {
                ...filters.totalAmount,
                $gte: totalFrom,
            }
        }

        const totalTo = toNumber(totalAmountTo)
        if (totalTo !== null) {
            filters.totalAmount = {
                ...filters.totalAmount,
                $lte: totalTo,
            }
        }

        const countFrom = toNumber(orderCountFrom)
        if (countFrom !== null) {
            filters.orderCount = {
                ...filters.orderCount,
                $gte: countFrom,
            }
        }

        const countTo = toNumber(orderCountTo)
        if (countTo !== null) {
            filters.orderCount = {
                ...filters.orderCount,
                $lte: countTo,
            }
        }

        const safeSearchRegex = normalizeSearchRegex(search)
        if (safeSearchRegex) {
            const orders = await Order.find(
                {
                    $or: [{ deliveryAddress: safeSearchRegex }],
                },
                '_id'
            )

            const orderIds = orders.map((order) => order._id)

            filters.$or = [{ name: safeSearchRegex }, { lastOrder: { $in: orderIds } }]
        }

        const safeSortField =
            typeof sortField === 'string' ? sortField : 'createdAt'
        const safeSortOrder = sortOrder === 'asc' ? 1 : -1

        const options = {
            sort: {
                [safeSortField]: safeSortOrder,
            },
            skip: pagination.skip,
            limit: pagination.limit,
        }

        const users = await User.find(filters, null, options).populate([
            'orders',
            {
                path: 'lastOrder',
                populate: {
                    path: 'products',
                },
            },
            {
                path: 'lastOrder',
                populate: {
                    path: 'customer',
                },
            },
        ])

        const totalUsers = await User.countDocuments(filters)
        const totalPages = Math.ceil(totalUsers / pagination.limit)

        res.status(200).json({
            customers: users,
            pagination: {
                totalUsers,
                totalPages,
                currentPage: pagination.page,
                pageSize: pagination.limit,
            },
        })
    } catch (error) {
        next(error)
    }
}

export const getCustomerById = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const user = await User.findById(req.params.id)
            .populate(['orders', 'lastOrder'])
            .orFail(() => new NotFoundError('User not found'))
        res.status(200).json(user)
    } catch (error) {
        next(error)
    }
}

export const updateCustomer = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const allowedUpdates = {
            name: req.body.name,
            phone: req.body.phone,
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            allowedUpdates,
            {
                new: true,
                runValidators: true,
            }
        )
            .orFail(() => new NotFoundError('User not found'))
            .populate(['orders', 'lastOrder'])
        res.status(200).json(updatedUser)
    } catch (error) {
        next(error)
    }
}

export const deleteCustomer = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const deletedUser = await User.findByIdAndDelete(req.params.id).orFail(
            () => new NotFoundError('User not found')
        )
        res.status(200).json(deletedUser)
    } catch (error) {
        next(error)
    }
}
