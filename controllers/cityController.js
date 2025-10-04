const City = require('../models/City');

exports.getCities = async (req, res) => {
    try {
        const cities = await City.find().sort({ name: 1 });
        res.json({ cities });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch cities' });
    }
};

exports.addCity = async (req, res) => {
    try {
        const { name, state } = req.body;
        const city = new City({ name, state });
        await city.save();
        res.status(201).json({ city });
    } catch (err) {
        res.status(400).json({ error: 'Failed to add city' });
    }
};

exports.deleteCity = async (req, res) => {
    try {
        await City.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: 'Failed to delete city' });
    }
};

exports.updateCity = async (req, res) => {
    try {
        const { name, state } = req.body;
        const city = await City.findByIdAndUpdate(req.params.id, { name, state }, { new: true });
        res.json({ city });
    } catch (err) {
        res.status(400).json({ error: 'Failed to update city' });
    }
};
