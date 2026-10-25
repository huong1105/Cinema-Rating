'use strict';

const catchAsync = require('../utils/catch-async');

class MovieController {
    constructor({ movieService }) {
        this.movieService = movieService;
    }

    getAllMovies = catchAsync(async (req, res) => {
        const movies = await this.movieService.getAllMovies();
        res.status(200).json({ data: movies });
    });

    getMovieById = catchAsync(async (req, res) => {
        const movie = await this.movieService.getMovieById(req.params.id);
        res.status(200).json({ data: movie });
    });

    createMovie = catchAsync(async (req, res) => {
        const movie = await this.movieService.createMovie(req.body);
        res.status(201).json({
            message: 'Tạo phim thành công',
            data: movie,
        });
    });

    deleteMovie = catchAsync(async (req, res) => {
        const result = await this.movieService.deleteMovie(req.params.id);
        res.status(200).json(result);
    });
}

module.exports = MovieController;