import { NextFunction, Request, Response } from 'express'
import { FilterQuery, Error as MongooseError, PipelineStage, Types } from 'mongoose'
import BadRequestError from '../errors/bad-request-error'
import NotFoundError from '../errors/not-found-error'
import Order, { IOrder, StatusType } from '../models/order'
import Product, { IProduct } from '../models/product'
import User from '../models/user'
import {
    normalizePagination,
    normalizeSearchRegex,
    sanitizePlainText,
} from '../utils/sanitizers'

const ORDER_SORT_FIELDS = new Set(['createdAt', 'totalAmount', 'orderNumber'])

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

export const getOrders = async (
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
            status,
            totalAmountFrom,
            totalAmountTo,
            orderDateFrom,
            orderDateTo,
            search,
        } = req.query

        if (
            status !== undefined &&
            (typeof status !== 'string' ||
                !Object.values(StatusType).includes(status as StatusType))
        ) {
            throw new BadRequestError('Invalid status filter')
        }

        const pagination = normalizePagination(page, limit, 10, 10)
        const filters: FilterQuery<Partial<IOrder>> = {}

        if (typeof status === 'string') {
            filters.status = status
        }

        const amountFrom = toNumber(totalAmountFrom)
        if (amountFrom !== null) {
            filters.totalAmount = {
                ...filters.totalAmount,
                $gte: amountFrom,
            }
        }

        const amountTo = toNumber(totalAmountTo)
        if (amountTo !== null) {
            filters.totalAmount = {
                ...filters.totalAmount,
                $lte: amountTo,
            }
        }

        const dateFrom = toDate(orderDateFrom)
        if (dateFrom) {
            filters.createdAt = {
                ...filters.createdAt,
                $gte: dateFrom,
            }
        }

        const dateTo = toDate(orderDateTo)
        if (dateTo) {
            filters.createdAt = {
                ...filters.createdAt,
                $lte: dateTo,
            }
        }

        const pipeline: PipelineStage[] = [
            { $match: filters },
            {
                $lookup: {
                    from: 'products',
                    localField: 'products',
                    foreignField: '_id',
                    as: 'products',
                },
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'customer',
                    foreignField: '_id',
                    as: 'customer',
                },
            },
            { $unwind: '$customer' },
            { $unwind: '$products' },
        ]

        const safeSearchRegex = normalizeSearchRegex(search)
        if (safeSearchRegex) {
            const searchString = typeof search === 'string' ? search.trim() : ''
            const searchNumber = Number(searchString)

            const searchConditions: Record<string, unknown>[] = [
                { 'products.title': safeSearchRegex },
            ]

            if (!Number.isNaN(searchNumber)) {
                searchConditions.push({ orderNumber: searchNumber })
            }

            pipeline.push({ $match: { $or: searchConditions } })
        }

        const safeSortField =
            typeof sortField === 'string' && ORDER_SORT_FIELDS.has(sortField)
                ? sortField
                : 'createdAt'

        const safeSortOrder = sortOrder === 'asc' ? 1 : -1

        pipeline.push(
            { $sort: { [safeSortField]: safeSortOrder } },
            { $skip: pagination.skip },
            { $limit: pagination.limit },
            {
                $group: {
                    _id: '$_id',
                    orderNumber: { $first: '$orderNumber' },
                    status: { $first: '$status' },
                    totalAmount: { $first: '$totalAmount' },
                    products: { $push: '$products' },
                    customer: { $first: '$customer' },
                    createdAt: { $first: '$createdAt' },
                },
            }
        )

        const orders = await Order.aggregate(pipeline)
        const totalOrders = await Order.countDocuments(filters)
        const totalPages = Math.ceil(totalOrders / pagination.limit)

        res.status(200).json({
            orders,
            pagination: {
                totalOrders,
                totalPages,
                currentPage: pagination.page,
                pageSize: pagination.limit,
            },
        })
    } catch (error) {
        next(error)
    }
}

export const getOrdersCurrentUser = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const userId = res.locals.user._id
        const { search, page, limit } = req.query
        const pagination = normalizePagination(page, limit, 5, 10)

        const user = await User.findById(userId)
            .populate({
                path: 'orders',
                populate: [{ path: 'products' }, { path: 'customer' }],
            })
            .orFail(() => new NotFoundError('User not found'))

        let orders = user.orders as unknown as IOrder[]
        const safeSearchRegex = normalizeSearchRegex(search)

        if (safeSearchRegex) {
            const searchString = typeof search === 'string' ? search.trim() : ''
            const searchNumber = Number(searchString)
            const products = await Product.find({ title: safeSearchRegex })
            const productIds = products.map((product) => product._id)

            orders = orders.filter((order) => {
                const matchesProduct = order.products.some((product) =>
                    productIds.some((id) => id.equals(product._id))
                )
                const matchesNumber =
                    !Number.isNaN(searchNumber) &&
                    order.orderNumber === searchNumber

                return matchesProduct || matchesNumber
            })
        }

        const totalOrders = orders.length
        const totalPages = Math.ceil(totalOrders / pagination.limit)
        const paginatedOrders = orders.slice(
            pagination.skip,
            pagination.skip + pagination.limit
        )

        return res.send({
            orders: paginatedOrders,
            pagination: {
                totalOrders,
                totalPages,
                currentPage: pagination.page,
                pageSize: pagination.limit,
            },
        })
    } catch (error) {
        next(error)
    }
}

export const getOrderByNumber = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const order = await Order.findOne({ orderNumber: req.params.orderNumber })
            .populate(['customer', 'products'])
            .orFail(() => new NotFoundError('Order not found'))

        return res.status(200).json(order)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Invalid order id'))
        }
        return next(error)
    }
}

export const getOrderCurrentUserByNumber = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const userId = res.locals.user._id
    try {
        const order = await Order.findOne({ orderNumber: req.params.orderNumber })
            .populate(['customer', 'products'])
            .orFail(() => new NotFoundError('Order not found'))

        if (!order.customer._id.equals(userId)) {
            return next(new NotFoundError('Order not found'))
        }

        return res.status(200).json(order)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Invalid order id'))
        }
        return next(error)
    }
}

export const createOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const userId = res.locals.user._id
        const { address, payment, phone, total, email, items } = req.body

        const itemIds = (items as string[]).map((id) => {
            if (!Types.ObjectId.isValid(id)) {
                throw new BadRequestError(`Invalid product id: ${id}`)
            }
            return new Types.ObjectId(id)
        })

        const products = await Product.find<IProduct>({ _id: { $in: itemIds } })

        if (products.length !== itemIds.length) {
            throw new BadRequestError('One or more products were not found')
        }

        if (products.some((product) => product.price === null)) {
            throw new BadRequestError('One or more products are unavailable')
        }

        const totalBasket = products.reduce(
            (sum, product) => sum + Number(product.price),
            0
        )

        if (totalBasket !== total) {
            return next(new BadRequestError('Invalid order total'))
        }

        const newOrder = new Order({
            totalAmount: total,
            products: itemIds,
            payment,
            phone,
            email,
            comment: sanitizePlainText(req.body.comment, 500),
            customer: userId,
            deliveryAddress: sanitizePlainText(address, 200),
        })

        const populateOrder = await newOrder.populate(['customer', 'products'])
        await populateOrder.save()

        return res.status(200).json(populateOrder)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        return next(error)
    }
}

export const updateOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { status } = req.body
        const updatedOrder = await Order.findOneAndUpdate(
            { orderNumber: req.params.orderNumber },
            { status },
            { new: true, runValidators: true }
        )
            .orFail(() => new NotFoundError('Order not found'))
            .populate(['customer', 'products'])

        return res.status(200).json(updatedOrder)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Invalid order id'))
        }
        return next(error)
    }
}

export const deleteOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const deletedOrder = await Order.findByIdAndDelete(req.params.id)
            .orFail(() => new NotFoundError('Order not found'))
            .populate(['customer', 'products'])

        return res.status(200).json(deletedOrder)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Invalid order id'))
        }
        return next(error)
    }
}

