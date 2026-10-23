'use strict';

const catchAsync = require('../utils/catch-async');

class GenreController {
    constructor({ genreService }) {
        this.genreService = genreService;
    }

    getAllGenres = catchAsync(async (req, res) => {
        const genres = await this.genreService.getAllGenres();
        res.status(200).json({ data: genres });
    });
}

module.exports = GenreController;