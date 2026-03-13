import { Joi, celebrate } from 'celebrate'
import { Types } from 'mongoose'

export const phoneRegExp = /^\+?[0-9\s()-]{10,20}$/

export enum PaymentType {
    Card = 'card',
    Online = 'online',
}

export const validateOrderBody = celebrate({
    body: Joi.object({
        items: Joi.array()
            .items(
                Joi.string().custom((value, helpers) => {
                    if (Types.ObjectId.isValid(value)) {
                        return value
                    }
                    return helpers.message({ custom: 'Invalid id' })
                })
            )
            .min(1)
            .max(20)
            .required()
            .messages({
                'array.empty': 'Items are required',
            }),
        payment: Joi.string()
            .valid(...Object.values(PaymentType))
            .required(),
        email: Joi.string().trim().email().max(254).required(),
        phone: Joi.string()
            .trim()
            .required()
            .pattern(phoneRegExp)
            .min(10)
            .max(20),
        address: Joi.string().trim().min(1).max(200).required(),
        total: Joi.number().required().min(0),
        comment: Joi.string().trim().max(500).optional().allow(''),
    }).unknown(false),
})

export const validateProductBody = celebrate({
    body: Joi.object({
        title: Joi.string().trim().required().min(2).max(30),
        image: Joi.object({
            fileName: Joi.string().trim().required(),
            originalName: Joi.string().trim().required(),
        }).required(),
        category: Joi.string().trim().required().max(50),
        description: Joi.string().trim().required().max(1000),
        price: Joi.number().allow(null),
    }).unknown(false),
})

export const validateProductUpdateBody = celebrate({
    body: Joi.object({
        title: Joi.string().trim().min(2).max(30),
        image: Joi.object({
            fileName: Joi.string().trim().required(),
            originalName: Joi.string().trim().required(),
        }),
        category: Joi.string().trim().max(50),
        description: Joi.string().trim().max(1000),
        price: Joi.number().allow(null),
    }).unknown(false),
})

export const validateObjId = celebrate({
    params: Joi.object({
        productId: Joi.string()
            .required()
            .custom((value, helpers) => {
                if (Types.ObjectId.isValid(value)) {
                    return value
                }
                return helpers.message({ any: 'Invalid id' })
            }),
    }).unknown(false),
})

export const validateUserBody = celebrate({
    body: Joi.object({
        name: Joi.string().trim().min(2).max(30),
        password: Joi.string().min(6).max(128).required(),
        email: Joi.string().trim().required().email().max(254),
    }).unknown(false),
})

export const validateAuthentication = celebrate({
    body: Joi.object({
        email: Joi.string().trim().required().email().max(254),
        password: Joi.string().required().max(128),
    }).unknown(false),
})
