'use strict';

class UserRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }

    async findByEmail(email) {
        return this.prisma.user.findUnique({
            where: { email },
        });
    }

    async findByUsername(username) {
        return this.prisma.user.findUnique({
            where: { username },
        });
    }

    async findById(id) {
        return this.prisma.user.findUnique({
            where: { id },
        });
    }

    async create({ email, username, passwordHash }) {
        return this.prisma.user.create({
            data: {
                email,
                username,
                passwordHash,
            },
        });
    }

    async update(id, data) {
        return this.prisma.user.update({
            where: { id },
            data,
        });
    }
}

module.exports = UserRepository;