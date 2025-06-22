using FabCollectionTool.Classes;
using System.Diagnostics;

namespace FabCollectionTool.TcgPowertools
{
    public class TcgList
    {
        public List<TcgDto> TcgDtos { get; set; } = new List<TcgDto>();

        public TcgList(ImportResult importResult, string pSetName)
        {
            TcgDtos = new List<TcgDto>();
            foreach (DataDto dataDto
                in importResult.DataDtos
                    .Where(dto
                        => dto.Set == pSetName
                        || (dto.Id != null && dto.Id.StartsWith(pSetName.ToUpper()))))
            {
                // skip invalid dtos
                if (string.IsNullOrWhiteSpace(dataDto.Id)
                    || dataDto.Id == "0"
                    || dataDto.Id.Length < 3)
                {
                    continue;
                }

                // assure ID has length of 6 (SET+Number)
                if (dataDto.Id.Length != 6)
                {
                    continue;
                }

                // that much cards are owned in that set
                int setcount = dataDto.ST + dataDto.RF + dataDto.CF + dataDto.GF;
                if (setcount <= 0)
                {
                    continue;
                }

                // do not auto-sell special art cards, marvels, legendaries or fabled
                if (!string.IsNullOrWhiteSpace(dataDto.ArtTreatment)
                    || dataDto.Rarity.Trim().ToLower().Equals("legendary")
                    || dataDto.Rarity.Trim().ToLower().Equals("marvel")
                    || dataDto.Rarity.Trim().ToLower().Equals("fabled"))
                {
                    continue;
                }

                // that much cards are owned in total
                int totalcount = 0;
                importResult.DataDtos
                    .Where(dto
                        => dto.Name == dataDto.Name
                        && dto.Pitch == dataDto.Pitch
                        && dto.Peculiarity == dataDto.Peculiarity)
                    .ToList()
                    .ForEach((dto) => { totalcount += dto.ST + dto.RF + dto.CF + dto.GF; });

                // assure playset is the same in all sets
                bool isPlaysetValid = importResult.DataDtos
                    .Where(dto
                        => dto.Name == dataDto.Name
                        && dto.Pitch == dataDto.Pitch
                        && dto.Peculiarity == dataDto.Peculiarity)
                    .GroupBy(dto => dto.Playset)
                    .Count() == 1;
                if (!isPlaysetValid)
                {
                    Debug.WriteLine(
                        $"WARNING: {dataDto.Name} has not the same playset in all sets!");
                    continue;
                }

                // how many can I sell
                int sellcount = totalcount - dataDto.Playset;

                //---------------------------------------------------------------------------------
                // TODO:
                // include cards currently offered on cardmarket into the calculation!
                //---------------------------------------------------------------------------------


                // skip if I can't sell
                if (sellcount <= 0      // I have enough across all sets to sell
                    || setcount <= 1)   // I have enough in set to sell (always keep one in set)
                {
                    continue;
                }

                string setcode = dataDto.Id[..3];   // get first 3 chars, ignore rest
                string cn = dataDto.Id[3..];        // ignore the first 3 chars, get rest

                // add pitch only if different pitch values exist in all sets
                string pitch = "";
                if (importResult.DataDtos.Any(dto 
                    => dto.Name.Equals(dataDto.Name) 
                    && !string.IsNullOrWhiteSpace(dto.Pitch)
                    && !dto.Pitch.Equals(dataDto.Pitch)))
                {
                    pitch = dataDto.Pitch;
                }

                // add standard cards in normal art
                if (sellcount > 0 // do not sell more than wanted
                    && setcount > 1 // keep at least one per set
                    && dataDto.ST > 0) // have to sell
                {
                    TcgDtos.Add(new TcgDto
                    {
                        Name = CardmarketHelper.GetName(
                            setcode,
                            dataDto.Name, 
                            pitch, 
                            CardVariant.Regular),
                        Quantity = GetToSell(ref sellcount, ref setcount, dataDto.ST),
                        Set = setcode, 
                        Cn = cn, 
                        Price = GetMinPrice(dataDto),
                    });
                }

                // add rainbow foil cards in normal art
                if (sellcount > 0 // do not sell more than wanted
                    && setcount > 1 // keep at least one per set
                    && dataDto.RF > 0) // have to sell
                {
                    TcgDtos.Add(new TcgDto
                    {
                        Name = CardmarketHelper.GetName(
                            setcode,
                            dataDto.Name,
                            pitch,
                            CardVariant.RainbowFoil),
                        Quantity = GetToSell(ref sellcount, ref setcount, dataDto.RF),
                        Set = setcode, // get first 3 chars, ignore rest
                        Cn = cn, // ignore the first 3 chars, get rest
                        Price = GetMinPrice(dataDto),
                    });
                }

                // add Cold Foil cards
                if (sellcount > 0 // do not sell more than wanted
                    && setcount > 1 // keep at least one per set 
                    && dataDto.CF > 0)
                {
                    TcgDtos.Add(new TcgDto
                    {
                        Name = CardmarketHelper.GetName(
                            setcode,
                            dataDto.Name,
                            pitch,
                            CardVariant.ColdFoil),
                        Quantity = GetToSell(ref sellcount, ref setcount, dataDto.CF),
                        Set = setcode, // get first 3 chars, ignore rest
                        Cn = cn, // ignore the first 3 chars, get rest
                        Price = GetMinPrice(dataDto),
                    });
                }

                // add Gold Foil cards
                if (sellcount > 0 // do not sell more than wanted
                    && setcount > 1 // keep at least one per set
                    && dataDto.GF > 0)
                {
                    TcgDtos.Add(new TcgDto
                    {
                        Name = CardmarketHelper.GetName(
                            setcode,
                            dataDto.Name,
                            pitch,
                            CardVariant.ColdFoilGolden),
                        Quantity = GetToSell(ref sellcount, ref setcount, dataDto.GF),
                        Set = setcode, // get first 3 chars, ignore rest
                        Cn = cn, // ignore the first 3 chars, get rest
                        Price = GetMinPrice(dataDto),
                    });
                }
            }
        }

        private static int GetToSell(ref int sellcount, ref int setcount, int have)
        {
            int toSell = 0;
            while (sellcount > 0 && setcount > 1 && have > 0)
            {
                toSell++;
                sellcount--;
                setcount--;
                have--;
            }
            return toSell;
        }

        private static string GetMinPrice(DataDto dataDto)
        {
            string normalized = dataDto.Rarity.Trim().ToLower();
            return normalized switch
            {
                "token" or "common" => "0.1",
                "rare" => "0.25",
                "super rare" => "2.50",
                "majestic" or "promo" => "5.0",
                "legendary" or "marvel" => "20.0",
                "fabled" => "50.0",
                _ => "1000.0",
            };
        }
    }
}
