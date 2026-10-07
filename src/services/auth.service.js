'use strict';

const AppError = require('../utils/app-error');

class AuthService {
    constructor({ userRepository, bcrypt, jwt }) {
        this.userRepository = userRepository;
        this.bcrypt = bcrypt;
        this.jwt = jwt;
    }

    async register({ email, username, password }) {
        if (!email || !username || !password) {
            throw new AppError('Vui long nhap day du thong tin', 400);
        }

        const existingEmail = await this.userRepository.findByEmail(email);
        if (existingEmail) {
            throw new AppError('Email da ton tai', 409);
        }

        const existingUsername = await this.userRepository.findByUsername(username);
        if (existingUsername) {
            throw new AppError('Username da ton tai', 409);
        }

        const passwordHash = await this.bcrypt.hash(password, 10);

        const user = await this.userRepository.create({
            email,
            username,
            passwordHash,
        });

        return {
            id: user.id,
            email: user.email,
            username: user.username,
            createdAt: user.createdAt,
        };
    }

    async login({ username, password }) {
        if (!username || !password) {
            throw new AppError('Vui long cung cap username va password', 400);
        }

        const user = await this.userRepository.findByUsername(username);
        if (!user) {
            throw new AppError('Username hoac password khong chinh xac', 401);
        }

        const isMatch = await this.bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            throw new AppError('Username hoac password khong chinh xac', 401);
        }

        const secret = process.env.JWT_SECRET || 'cinerate-secret-key';
        const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
        const token = this.jwt.sign(
            {
                id: user.id,
                username: user.username
            },
            secret,
            { expiresIn }
        );

        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
            },
        };
    }

    async getProfile(userId) {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new AppError('User khong ton tai', 404);
        }

        return {
            id: user.id,
            email: user.email,
            username: user.username,
            createdAt: user.createdAt,
        };
    }

    async updateProfile(userId, { email, currentPassword, newPassword }) {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new AppError('khong tim thay nguoi dung', 404);
        }

        const updateData = {};

        if (email && email !== user.email) {
            const existingEmail = await this.userRepository.findByEmail(email);
            if (existingEmail && existingEmail.id !== userId) {
                throw new AppError('Email da duoc su dung', 409);
            }
            updateData.email = email;
        }

        if (newPassword) {
            if (!currentPassword) {
                throw new AppError('Mat khau hien tai la bat buoc', 400);
            }
            const isMatch = await this.bcrypt.compare(currentPassword, user.passwordHash);
            if (!isMatch) {
                throw new AppError('Mat khau hien tai khong dung', 400);
            }
            updateData.passwordHash = await this.bcrypt.hash(newPassword, 10);
        }

        if (Object.keys(updateData).length === 0) {
            throw new AppError('Khong co thong tin nao duoc cap nhat', 400);
        }

        const updatedUser = await this.userRepository.update(userId, updateData);

        return {
            id: updatedUser.id,
            email: updatedUser.email,
            username: updatedUser.username,
            updatedAt: updatedUser.updatedAt,
        };
    }
}

module.exports = AuthService;