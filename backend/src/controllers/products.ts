import { NextFunction, Request, Response } from 'express'
import { constants } from 'http2'
import { Error as MongooseError } from 'mongoose'
import { join } from 'path'
import BadRequestError from '../errors/bad-request-error'
import ConflictError from '../errors/conflict-error'
import NotFoundError from '../errors/not-found-error'
import Product from '../models/product'
import { normalizePagination } from '../utils/sanitizers'
import movingFile from '../utils/movingFile'

const getProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { page, limit } = req.query
        const pagination = normalizePagination(page, limit, 5, 10)
        const options = {
            skip: pagination.skip,
            limit: pagination.limit,
        }

        const products = await Product.find({}, null, options)
        const totalProducts = await Product.countDocuments({})
        const totalPages = Math.ceil(totalProducts / pagination.limit)
        return res.send({
            items: products,
            pagination: {
                totalProducts,
                totalPages,
                currentPage: pagination.page,
                pageSize: pagination.limit,
            },
        })
    } catch (err) {
        return next(err)
    }
}

const createProduct = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { description, category, price, title, image } = req.body

        if (image) {
            movingFile(
                image.fileName,
                join(__dirname, `../public/${process.env.UPLOAD_PATH_TEMP}`),
                join(__dirname, `../public/${process.env.UPLOAD_PATH}`)
            )
        }

        const product = await Product.create({
            description,
            image,
            category,
            price,
            title,
        })
        return res.status(constants.HTTP_STATUS_CREATED).send(product)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        if (error instanceof Error && error.message.includes('E11000')) {
            return next(new ConflictError('Product with this title already exists'))
        }
        return next(error)
    }
}

const updateProduct = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { productId } = req.params
        const { image } = req.body

        if (image) {
            movingFile(
                image.fileName,
                join(__dirname, `../public/${process.env.UPLOAD_PATH_TEMP}`),
                join(__dirname, `../public/${process.env.UPLOAD_PATH}`)
            )
        }

        const product = await Product.findByIdAndUpdate(
            productId,
            {
                $set: {
                    ...req.body,
                    price: req.body.price ? req.body.price : null,
                    image: req.body.image ? req.body.image : undefined,
                },
            },
            { runValidators: true, new: true }
        ).orFail(() => new NotFoundError('Product not found'))
        return res.send(product)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Invalid product id'))
        }
        if (error instanceof Error && error.message.includes('E11000')) {
            return next(new ConflictError('Product with this title already exists'))
        }
        return next(error)
    }
}

const deleteProduct = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { productId } = req.params
        const product = await Product.findByIdAndDelete(productId).orFail(
            () => new NotFoundError('Product not found')
        )
        return res.send(product)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Invalid product id'))
        }
        return next(error)
    }
}

export { createProduct, deleteProduct, getProducts, updateProduct }
