import crypto from 'crypto'
import { NextFunction, Request, Response } from 'express'
import { constants } from 'http2'
import jwt, { JwtPayload } from 'jsonwebtoken'
import { Error as MongooseError } from 'mongoose'
import { REFRESH_TOKEN } from '../config'
import BadRequestError from '../errors/bad-request-error'
import ConflictError from '../errors/conflict-error'
import NotFoundError from '../errors/not-found-error'
import UnauthorizedError from '../errors/unauthorized-error'
import User from '../models/user'
import { sanitizePlainText } from '../utils/sanitizers'

const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = req.body
        const user = await User.findUserByCredentials(email, password)
        const accessToken = user.generateAccessToken()
        const refreshToken = await user.generateRefreshToken()
        res.cookie(
            REFRESH_TOKEN.cookie.name,
            refreshToken,
            REFRESH_TOKEN.cookie.options
        )
        return res.json({
            success: true,
            user,
            accessToken,
        })
    } catch (err) {
        return next(err)
    }
}

const register = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { password } = req.body
        const email = typeof req.body.email === 'string' ? req.body.email.trim() : ''
        const name = sanitizePlainText(req.body.name, 30)

        const newUser = new User({ email, password, name })
        await newUser.save()
        const accessToken = newUser.generateAccessToken()
        const refreshToken = await newUser.generateRefreshToken()

        res.cookie(
            REFRESH_TOKEN.cookie.name,
            refreshToken,
            REFRESH_TOKEN.cookie.options
        )
        return res.status(constants.HTTP_STATUS_CREATED).json({
            success: true,
            user: newUser,
            accessToken,
        })
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        if (error instanceof Error && error.message.includes('E11000')) {
            return next(new ConflictError('User with this email already exists'))
        }
        return next(error)
    }
}

const getCurrentUser = async (
    _req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const userId = res.locals.user._id
        const user = await User.findById(userId).orFail(
            () => new NotFoundError('User not found')
        )
        res.json({ user, success: true })
    } catch (error) {
        next(error)
    }
}

const deleteRefreshTokenInUser = async (
    req: Request,
    _res: Response,
    _next: NextFunction
) => {
    const { cookies } = req
    const rfTkn = cookies[REFRESH_TOKEN.cookie.name]

    if (!rfTkn) {
        throw new UnauthorizedError('Invalid token')
    }

    const decodedRefreshTkn = jwt.verify(
        rfTkn,
        REFRESH_TOKEN.secret
    ) as JwtPayload
    const user = await User.findOne({
        _id: decodedRefreshTkn._id,
    }).orFail(() => new UnauthorizedError('User not found'))

    const rTknHash = crypto
        .createHmac('sha256', REFRESH_TOKEN.secret)
        .update(rfTkn)
        .digest('hex')

    user.tokens = user.tokens.filter((tokenObj) => tokenObj.token !== rTknHash)

    await user.save()

    return user
}

const logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await deleteRefreshTokenInUser(req, res, next)
        const expireCookieOptions = {
            ...REFRESH_TOKEN.cookie.options,
            maxAge: -1,
        }
        res.cookie(REFRESH_TOKEN.cookie.name, '', expireCookieOptions)
        res.status(200).json({
            success: true,
        })
    } catch (error) {
        next(error)
    }
}

const refreshAccessToken = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const userWithRefreshTkn = await deleteRefreshTokenInUser(
            req,
            res,
            next
        )
        const accessToken = await userWithRefreshTkn.generateAccessToken()
        const refreshToken = await userWithRefreshTkn.generateRefreshToken()
        res.cookie(
            REFRESH_TOKEN.cookie.name,
            refreshToken,
            REFRESH_TOKEN.cookie.options
        )
        return res.json({
            success: true,
            user: userWithRefreshTkn,
            accessToken,
        })
    } catch (error) {
        return next(error)
    }
}

const getCurrentUserRoles = async (
    _req: Request,
    res: Response,
    next: NextFunction
) => {
    const userId = res.locals.user._id
    try {
        const user = await User.findById(userId).orFail(
            () => new NotFoundError('User not found')
        )
        res.status(200).json(user.roles)
    } catch (error) {
        next(error)
    }
}

const updateCurrentUser = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const userId = res.locals.user._id
    try {
        const allowedPayload = {
            name: sanitizePlainText(req.body.name, 30),
            phone:
                typeof req.body.phone === 'string'
                    ? req.body.phone.trim().slice(0, 20)
                    : undefined,
        }

        const updatedUser = await User.findByIdAndUpdate(userId, allowedPayload, {
            new: true,
            runValidators: true,
        }).orFail(() => new NotFoundError('User not found'))
        res.status(200).json(updatedUser)
    } catch (error) {
        next(error)
    }
}

export {
    getCurrentUser,
    getCurrentUserRoles,
    login,
    logout,
    refreshAccessToken,
    register,
    updateCurrentUser,
}

